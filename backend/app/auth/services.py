from ..config import Config
from ..extensions import db
from ..common.error import ClientError
from ..common.decorators import database_guard
from .models import User, Group, Visited
from .schemas import (
	CreateUserSchema, GetUserSchema, UpdateUserSchema, LoginSchema,
	CreateGroupSchema, GetGroupSchema, UpdateGroupSchema, VisitedSchema
)
from . import Permission, ensure_perm, ensure_root

from flask_login import login_user, logout_user, login_required, current_user
from typing import Any
from threading import Event
import requests
import secrets
import json


class AuthService:
	def __init__(self, app):
		self.app = app
		self._val_listeners: dict[int, tuple[str, Event]] = {}
	
	def setup(self):
		def check_validation(data: dict[str, Any]):
			if (listener := self._val_listeners.get(data["user"])):
				if listener[0] == data["room"]:
					listener[1].set()
		self.app.rooms_api.service.register_event_hook("create_room", check_validation)
	
	def search_user(self, username: str) -> int|None:
		url = f"https://phira.5wyxi.com/user/?pageNum=1&page=1&search={username}"
		resp = requests.get(url, timeout=10)
		data = resp.json()
		if resp.status_code != 200:
			resp.raise_for_status()

		if data["count"] != 1:
			return None
		info = data["results"][0]
		if info["name"] != username:
			return None
		return info["id"]

	def sync_phira_profile(self, user: User, force: bool = False) -> None:
		if user.phira_id and (force or user.check_sync_time()):
			url = f"https://phira.5wyxi.com/user/{user.phira_id}"
			resp = requests.get(url, timeout=10)
			data = resp.json()
			if resp.status_code != 200:
				if data.get("error") == "requested entry not found":
					raise ClientError("invalid phira id")
				resp.raise_for_status()

			user.phira_username = data.get("name")
			user.phira_rks = data.get("rks", float('nan'))
			user.phira_avatar = data.get("avatar")
			user.update_sync_time()

	@login_required
	def get_current_user_info(self):
		return GetUserSchema().dump(current_user)

	def create_user(self, data: dict[str, Any]) -> dict[str, Any]:
		s = data.pop("phira_id_or_username")
		data["phira_id"] = int(s) if s.isdigit() else self.search_user(s)

		user = User(**data)
		if user.group_id != 3:
			ensure_perm(Permission.GROUP_MANAGEMENT)
		if User.query.filter_by(username=user.username).first():
			raise ClientError("username already exists")
		if User.query.filter_by(phira_id=user.phira_id).first():
			raise ClientError("phira id already bound")
		if self._val_listeners.get(user.phira_id):
			raise ClientError("phira id is in another validating process")
		else:
			self._val_listeners[user.phira_id] = ()

		def generator():
			with self.app.app_context():
				try:
					token = secrets.token_hex(4)
					while self.app.rooms_api.service.get_room(token):
						token = secrets.token_hex(4)
					e = Event()
					self._val_listeners[user.phira_id] = (token, e)
					yield f"event: validating\ndata: {token}\n\n"

					for _ in range(300):
						if e.wait(1):
							self.sync_phira_profile(user)
							db.session.add(user)
							yield f"event: success\ndata: {json.dumps(GetUserSchema().dump(user))}\n\n"
							return
						yield ": heartbeat\n\n"
					yield f"event: timeout\n\n"

				except Exception as e:
					db.session.rollback()
					yield f"event: error\ndata: {repr(e)}\n\n"

				finally:
					self._val_listeners.pop(user.phira_id)
					db.session.commit()

		return generator()

	@database_guard
	def login(self, data: dict[str, Any]) -> dict[str, Any]:
		user: User|None = User.query.filter_by(username=data["username"]).first()
		if not user:
			raise ClientError("invalid username")
		if not user.check_password(data["password"]):
			raise ClientError("incorrect password")

		login_user(user, remember=data["remember"])
		user.update_login_time()
		self.sync_phira_profile(user)
		return GetUserSchema().dump(user)

	@login_required
	def logout(self) -> None:
		logout_user()
	
	@database_guard
	def get_user_list(self) -> list[dict]:
		users = User.query.all()
		for user in users:
			self.sync_phira_profile(user)
		return GetUserSchema(many=True).dump(users)

	@database_guard
	def get_user_info(self, user_id: int) -> dict[str, Any]:
		user = User.query.filter_by(id=user_id).first()
		if not user:
			raise ClientError("invalid user id")
		self.sync_phira_profile(user)
		return GetUserSchema().dump(user)

	@database_guard
	@login_required
	def update_user_info(self, user_id: int, data: dict[str, Any]) -> dict[str, Any]:
		user: User = User.query.filter_by(id=user_id).first()
		if not user:
			raise ClientError("invalid user id")
		if not current_user.check_password(data.get("current_password")):
			raise ClientError("incorrect password")
		if user.group_id == 1:
			raise ClientError("cannot modify super admin", 403)
		if user.has_permission(Permission.IMPORTANT) and current_user.id != user.id and current_user.group_id != 1:
			raise ClientError("cannot modify important user", 403)

		if (value := data.get("group_id")):
			if not Group.query.filter_by(id=value).first():
				raise ClientError(f"invalid group id {value}")
			if current_user.id != user_id:
				ensure_perm(Permission.GROUP_MANAGEMENT)
			user.group_id = value

		if (value := data.get("username")):
			if value != user.username and User.query.filter_by(username=value).first():
				raise ClientError(f"username '{value}' already exists")
			if current_user.id != user_id:
				ensure_perm(Permission.USER_MANAGEMENT)
			user.username = value
	
		if (value := data.get("phira_id")):
			if value != user.phira_id and User.query.filter_by(phira_id=value).first():
				raise ClientError(f"phira_id {value} already bound")
			ensure_perm(Permission.USER_MANAGEMENT)
			user.phira_id = value
			self.sync_phira_profile(user, force=True)

		if (value := data.get("password")):
			if current_user.id != user_id:
				ensure_perm(Permission.USER_MANAGEMENT)
			user.password = value

		return GetUserSchema().dump(user)

	@database_guard
	@login_required
	def delete_user(self, user_id: int) -> None:
		ensure_perm(Permission.USER_MANAGEMENT)
		q = User.query.filter_by(id=user_id)
		user: User = q.first()
		if not user:
			raise ClientError(f"invalid user id {user_id}")
		if user.has_permission(Permission.IMPORTANT):
			ensure_root()
		q.delete()

	@database_guard
	@login_required
	def create_group(self, data: dict[str, Any]) -> dict[str, Any]:
		ensure_perm(Permission.GROUP_MANAGEMENT)
		group = Group(**data)
		if Group.query.filter_by(name=group.name).first():
			raise ClientError(f"group '{group.name}' already exists")
		db.session.add(group)
		return group

	def get_group_list(self) -> list[dict[str, Any]]:
		return GetGroupSchema(many=True).dump(Group.query.all())

	def get_group_info(self, group_id: int) -> dict[str, Any]:
		group = Group.query.filter_by(id=group_id).first()
		return GetGroupSchema().dump(group)

	@database_guard
	@login_required
	def update_group_info(self, group_id: int, data: dict[str, Any]) -> dict[str, Any]:
		ensure_perm(Permission.GROUP_MANAGEMENT)
		group = Group.query.filter_by(id=group_id).first()
		if not group:
			raise ClientError("invalid group_id")
		if not current_user.check_password(data.get("current_password")):
			raise ClientError("incorrect password")

		if (value := data.get("name")):
			if value != group.name and Group.query.filter_by(name=value).first():
				raise ClientError(f"group '{value}' already exists")
			group.name = value

		if (value := data.get("permissions")):
			group.permissions = value

		return GetGroupSchema().dump(group)

	@database_guard
	@login_required
	def delete_group(self, group_id: int) -> None:
		ensure_perm(Permission.GROUP_MANAGEMENT)
		q = Group.query.filter_by(id=group_id)
		if not q.first():
			raise ClientError(f"invalid group id {group_id}")
		q.delete()

	def get_visited(self) -> list[int]:
		return VisitedSchema(many=True).dump(Visited.query.all())

	def get_visited_count(self) -> int:
		return Visited.query.count()
