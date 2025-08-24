from ..config import Config
from ..common import executor, exit_event
from . import PlayerRecord, RoundData, RoomData

from threading import Thread, Event
from queue import Queue
import dataclasses, json
import os, time, select
import logging

class RoomsService:
	def __init__(self):
		self._rooms: dict[str, RoomData] = {}
		self._users_room: dict[int, str] = {}
		self._queues: set[Queue] = set()
		executor.submit(self.listening_thread)

	def listening_thread(self):
		fd = None
		file_obj = None

		try:
			while not exit_event.is_set():
				try:
					fd = os.open(Config.LOG_PROCESSOR_PIPE, os.O_RDONLY | os.O_NONBLOCK)
					file_obj = os.fdopen(fd, 'r', encoding='utf-8', errors='replace')
				except OSError as e:
					logging.error(f"failed to open pipe: {e}, retrying...")
					time.sleep(0.5)
					continue

				while not exit_event.is_set():
					try:
						rlist, _, _ = select.select([file_obj.fileno()], [], [], 0.5)
					except (ValueError, OSError):
						break
					if not rlist:
						continue
					line = file_obj.readline()
					if line == "":
						break
					try:
						event = json.loads(line)
						self.process_event(event)
					except Exception as e:
						logging.error(f"failed to process event: {e}")
		finally:
			if file_obj:
				file_obj.close()

	def process_event(self, event: dict):
		name = event.get("room")
		user = event.get("user")
		room = self._rooms.get(name) if name else None

		match event["type"]:
			case "CreateRoom":
				room = RoomData(host=user, users={user})
				self._rooms[name] = room
				self._users_room[user] = name
				self.broadcast("create_room", {
					"room": name,
					"data": dataclasses.asdict(room)
				})

			case "UpdateRoom":
				data = event["data"]
				match data.pop("state", None):
					case "GameStart":
						room.rounds.append(RoundData(chart=room.chart))
						room.playing_users = room.users.copy()
						data["state"] = RoomData.State.PLAYING
						self.broadcast("start_round", {"room": name})
					case "WaitForReady":
						data["state"] = RoomData.State.WAITING_FOR_READY

				for k, v in data.items():
					setattr(room, k, v)
				self.broadcast("update_room", {"room": name, "data": data})

			case "JoinRoom":
				self._users_room[user] = name
				room.users.add(user)
				self.broadcast("join_room", {"room": name, "user": user})

			case "LeaveRoom":
				name = self._users_room.pop(user)
				room = self._rooms[name]
				room.users.discard(user)
				if len(room.users) == 0:
					self._rooms.pop(name)
				self.broadcast("leave_room", {"room": name, "user": user})

			case "PlayerScore" | "Abort":
				if (record := event.get("record")):
					room.rounds[-1].records.append(PlayerRecord(**record))
					self.broadcast("player_score", {"room": name, "record": record})
				else:
					name = self._users_room[user]
					room = self._rooms[name]

				room.playing_users.discard(user)
				if len(room.playing_users) == 0:
					room.state = RoomData.State.SELECTING_CHART
					room.chart = None
					self.broadcast("update_room", {
						"room": name,
						"data": {"state": RoomData.State.SELECTING_CHART, "chart": None}
					})

			case "NewHost":
				name = self._users_room[user]
				room = self._rooms[name]
				room.host = user
				self.broadcast("update_room", {"room": name, "data": {"host": user}})

	def get_rooms(self):
		return [{"name": name, **dataclasses.asdict(room)} for name, room in self._rooms.items()]

	def get_room(self, name: str):
		room = self._rooms.get(name)
		return dataclasses.asdict(room) if room else None

	def get_users_room(self, user_id: int):
		name = self._users_room.get(user_id)
		return dataclasses.asdict(self._rooms[name]) if name else None

	def broadcast(self, event: str, data):
		for q in self._queues:
			q.put((event, data))

	def new_listener(self):
		def generator():
			q = Queue()
			try:
				self._queues.add(q)
				yield f"event: init\ndata: {json.dumps(self.get_rooms())}\n\n"
				while True:
					event, data = q.get()
					yield f"event: {event}\ndata: {json.dumps(data)}\n\n"
			finally:
				self._queues.discard(q)
		return generator()
