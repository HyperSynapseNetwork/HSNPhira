from ..extensions import db, lm
from ..config import Config
from ..common import ClientError, database_protect
from .models import User, Group
from . import Perm, perm_required, perm_required_context, super_admin_required_context
from flask_login import login_user, logout_user, login_required, current_user
import requests


class AuthService:
	@database_protect
	@staticmethod
	def seed_db():
		default_groups=[
			{"name": "super_admin", "permissions": Perm.ALL},
			{"name": "admin", "permissions": Perm.IMPORTANT|Perm.USER_MANAGEMENT},
			{"name": "user", "permissions": 0}
		]
		default_users=[
			{"username": "root", "password": Config.SECRET_KEY, "group_id": 1}
		]
		for kwargs in default_groups:
			db.session.add(Group(**kwargs))
		for kwargs in default_users:
			db.session.add(Group(**kwargs))

	@database_protect
	def create_user(self, username: str, password: str, group_id: int, phira_id: int) -> User:
		if User.query.filter_by(username=username).first():
			raise ClientError("username already exists")
		if User.query.filter_by(phira_id=phira_id).first():
			raise ClientError("phira id already bound")

		phira_profile = self.fetch_phira_profile(phira_id)
		user = User(
			username=username,
			group_id=group_id,
			phira_id=phira_id,
			**phira_profile
		)
		user.password = password

		# TODO: phira account validation
		db.session.add(user)
		return user

	@database_protect
	def login(self, username: str, password: str, remember: bool) -> User:
		user = User.query.filter_by(username=username).first()
		if not user:
			raise ClientError("invalid username")
		if not user.check_password(password):
			raise ClientError("incorrect password")

		login_user(user)
		login_user(user, remember=remember)
		user.update_login_time()
		return user

	@login_required
	def logout(self) -> None:
		logout_user()

	def fetch_phira_profile(self, phira_id: int) -> dict:
		url = f"https://phira.5wyxi.com/user/{phira_id}"
		resp = requests.get(url, timeout=10)
		data = resp.json()
		if resp.status_code != 200:
			raise ClientError(f"failed to get profile: {data.get("error")}",resp.status_code)
		return {
			"phira_username": data.get("name"),
			"phira_rks": data.get("rks", float('nan')),
			"phira_avatar": data.get("avatar")
		}
	
	@database_protect
	def get_user_list(self) -> list[dict]:
		user_list = User.query.all()
		for user in user_list:
			if user.phira_id and user.check_sync_time():
				user.update_from_dict(self.fetch_phira_profile(user.phira_id))
				user.update_sync_time()
		return [user.to_dict() for user in User.query.all()]

	@database_protect
	def get_user_profile(self, user_id: int) -> dict:
		user = User.query.filter_by(id=user_id).first()
		if not user:
			raise ClientError("invalid user id")
		if user.phira_id and user.check_sync_time():
			user.update_from_dict(self.fetch_phira_profile(user.phira_id))
			user.update_sync_time()
		return user.to_dict()

	@database_protect
	@login_required
	def update_user_profile(self, user_id: int, user_info: dict) -> User:
		user = User.query.filter_by(id=user_id).first()
		if not user:
			raise ClientError("invalid user id")
		if user.group_id == 1:
			raise ClientError("cannot modify super admin", 403)
		if user.has_permission(Perm.IMPORTANT) and current_user.id != user.id and current_user.group_id != 1:
			raise ClientError("cannot modify important user", 403)

		perm = Perm.NONE
		need_sync = False
		if (value := user_info.get("group_id")):
			if not Group.query.filter_by(id=value).first():
				raise ClientError(f"invalid group id {value}")
			perm |= Perm.GROUP_MANAGEMENT

		if (value := user_info.get("username")):
			if value != user.username and User.query.filter_by(username=value).first():
				raise ClientError(f"username '{value}' already exists")
			perm |= Perm.USER_MANAGEMENT

		if (value := user_info.get("phira_id")):
			if value != user.phira_id and User.query.filter_by(phira_id=value).first():
				raise ClientError(f"phira_id {value} already bound")
			perm |= Perm.USER_MANAGEMENT
			need_sync = True

		if (value := user_info.get("password")):
			if current_user.id != user_id:
				perm |= Perm.USER_MANAGEMENT

		with perm_required_context(perm):
			user.update_from_dict(user_info)
			if need_sync:
				user.update_from_dict(self.fetch_phira_profile(user.phira_id))
				user.update_sync_time()
			return user

	@database_protect
	@perm_required(Perm.USER_MANAGEMENT)
	def delete_user(self, user_id: int) -> None:
		q = User.query.filter_by(id=user_id)
		user = q.first()
		if not user:
			raise ClientError(f"invalid user id {user_id}")
		if (user.group.permissions&Perm.IMPORTANT):
			with super_admin_required_context():
				q.delete()
		else:
			q.delete()

	@database_protect
	@perm_required(Perm.GROUP_MANAGEMENT)
	def create_group(self, name: str, permissions: Perm) -> Group:
		if Group.query.filter_by(name=name).first():
			raise ClientError(f"group '{name}' already exists")
		group = Group(name=name, permissions=permissions)
		db.session.add(group)
		return group

	def get_group_list(self) -> list[dict]:
		return [group.to_dict() for group in Group.query.all()]

	def get_group_info(self, group_id: int) -> dict:
		return Group.query.filter_by(id=group_id).first().to_dict()

	@database_protect
	@perm_required(Perm.GROUP_MANAGEMENT)
	def update_group_info(self, group_id: int, info: dict) -> Group:
		group = Group.query.filter_by(id=group_id).first()
		if not group:
			raise ClientError("invalid group_id")

		if (value := info.get("name")):
			if value != group.name and Group.query.filter_by(name=value).first():
				raise ClientError(f"group '{value}' already exists")

		group.update_from_dict(info)
		return group
	
	@database_protect
	@perm_required(Perm.GROUP_MANAGEMENT)
	def delete_group(self, group_id: int) -> None:
		q = Group.query.filter_by(id=group_id)
		if not q.first():
			raise ClientError(f"invalid group id {group_id}")
		q.delete()
