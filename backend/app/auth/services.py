from ..extensions import db, lm
from ..config import Config
from ..common import ClientError, database_protect
from .models import User, Group
from .schemas import user_schema, group_schema
from . import Permission, ensure_perm, ensure_super_admin
from flask_login import login_user, logout_user, login_required, current_user
from typing import Any
import requests


class AuthService:
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
		return user_schema().dump(current_user)

	@database_protect
	def create_user(self, data: dict[str, Any]) -> dict[str, Any]:
		user = User(**data)
		if User.query.filter_by(username=user.id).first():
			raise ClientError("username already exists")
		if User.query.filter_by(phira_id=user.phira_id).first():
			raise ClientError("phira id already bound")
		if user.group_id != 3:
			ensure_perm(Permission.GROUP_MANAGEMENT)

		# TODO: phira account validation
		self.sync_phira_profile(user)
		db.session.add(user)
		return user_schema().dump(user)

	@database_protect
	def login(self, data: dict[str, Any]) -> dict[str, Any]:
		user: User|None = User.query.filter_by(username=data["username"]).first()
		if not user:
			raise ClientError("invalid username")
		if not user.check_password(data["password"]):
			raise ClientError("incorrect password")

		login_user(user, remember=data["remember"])
		user.update_login_time()
		self.sync_phira_profile(user)
		return user_schema().dump(user)

	@login_required
	def logout(self) -> None:
		logout_user()
	
	@database_protect
	@login_required
	def get_user_list(self) -> list[dict]:
		users = User.query.all()
		for user in users:
			self.sync_phira_profile(user)
		return user_schema(many=True).dump(users)

	@database_protect
	@login_required
	def get_user_info(self, user_id: int) -> dict[str, Any]:
		user = User.query.filter_by(id=user_id).first()
		if not user:
			raise ClientError("invalid user id")
		self.sync_phira_profile(user)
		return user_schema().dump(user)

	@database_protect
	@login_required
	def update_user_info(self, user_id: int, data: dict[str, Any]) -> dict[str, Any]:
		user: User = User.query.filter_by(id=user_id).first()
		if not user:
			raise ClientError("invalid user id")
		if user.group_id == 1:
			raise ClientError("cannot modify super admin", 403)
		if user.has_permission(Permission.IMPORTANT) and current_user.id != user.id and current_user.group_id != 1:
			raise ClientError("cannot modify important user", 403)

		if (value := data.get("group_id")):
			if not Group.query.filter_by(id=value).first():
				raise ClientError(f"invalid group id {value}")
			ensure_perm(Permission.GROUP_MANAGEMENT)
			user.group_id = value

		if (value := data.get("username")):
			if value != user.username and User.query.filter_by(username=value).first():
				raise ClientError(f"username '{value}' already exists")
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

		return user_schema().dump(user)

	@database_protect
	@login_required
	def delete_user(self, user_id: int) -> None:
		ensure_perm(Permission.USER_MANAGEMENT)
		q = User.query.filter_by(id=user_id)
		user: User = q.first()
		if not user:
			raise ClientError(f"invalid user id {user_id}")
		if user.has_permission(Permission.IMPORTANT):
			ensure_super_admin()
		q.delete()

	@database_protect
	@login_required
	def create_group(self, data: dict[str, Any]) -> dict[str, Any]:
		ensure_perm(Permission.GROUP_MANAGEMENT)
		group = Group(**data)
		if Group.query.filter_by(name=group.name).first():
			raise ClientError(f"group '{group.name}' already exists")
		db.session.add(group)
		return group

	@login_required
	def get_group_list(self) -> list[dict[str, Any]]:
		return group_schema(many=True).dump(Group.query.all())

	@login_required
	def get_group_info(self, group_id: int) -> dict[str, Any]:
		group = Group.query.filter_by(id=group_id).first()
		return group_schema().dump(group)

	@database_protect
	@login_required
	def update_group_info(self, group_id: int, data: dict[str, Any]) -> dict[str, Any]:
		ensure_perm(Permission.GROUP_MANAGEMENT)
		group = Group.query.filter_by(id=group_id).first()
		if not group:
			raise ClientError("invalid group_id")

		if (value := data.get("name")):
			if value != group.name and Group.query.filter_by(name=value).first():
				raise ClientError(f"group '{value}' already exists")
			group.name = value

		if (value := data.get("permissions")):
			group.permissions = value

		return group_schema().dump(group)
	
	@database_protect
	@login_required
	def delete_group(self, group_id: int) -> None:
		ensure_perm(Permission.GROUP_MANAGEMENT)
		q = Group.query.filter_by(id=group_id)
		if not q.first():
			raise ClientError(f"invalid group id {group_id}")
		q.delete()
