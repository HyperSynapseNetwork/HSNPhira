from ..common import ClientError
from ..config import Config
from . import PlayerRecord, RoundData, RoomData
from threading import Thread, Event
from queue import Queue
import subprocess
import dataclasses
import json
import os

class ListeningThread(Thread):
	def __init__(self, service, *args, **kwargs):
		super().__init__(*args, **kwargs)
		self._stop_event: Event|None = None
		self._child: subprocess.Popen|None = None
		self._service: RoomsService = service

	def __del__(self):
		self.stop()
		if self._child:
			self._child.wait()
		self.join()

	def run(self):
		self._stop_event = Event()
		self._child = subprocess.Popen(
			Config.PHIRA_LOG_PROCESSOR_PATH,
			stdout=subprocess.PIPE
		)
		while True:
			line = self._child.stdout.readline()
			if self._stop_event.is_set() or line == b"":
				break
			event = json.loads(line.decode())
			self._service.process_event(event)

	def stop(self):
		self._stop_event.set()
		if self._child and self._child.poll() is not None:
			self._child.kill()

class RoomsService:
	def __init__(self):
		self._rooms: dict[str, RoomData] = {}
		self._users_room: dict[int, str] = {}
		self._queues: set[Queue] = set()
		self._listening_thread = ListeningThread(self)
		self._listening_thread.start()

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
					self.broadcast("update_room", {
						"room": name,
						"data": {"state": RoomData.State.SELECTING_CHART}
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
