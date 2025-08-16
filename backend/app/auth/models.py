from ..extensions import db, lm
from ..common import ModelInfoMixin
from . import Perm
from flask_login import UserMixin
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import datetime, timedelta, timezone

class User(ModelInfoMixin, UserMixin, db.Model):
	__tablename__ = "users"

	# user id
	id = db.Column(db.Integer, primary_key=True, autoincrement=True, nullable=False)
	# user's group id
	group_id = db.Column(db.Integer, db.ForeignKey("groups.id"), nullable=False)
	# user's group
	group = db.relationship("Group", back_populates="users")
	# username
	username = db.Column(db.String(32), unique=True, nullable=False)
	# hash of user's password
	password_hash = db.Column(db.String(128), nullable=False)
	# user's Phira id
	phira_id = db.Column(db.Integer, unique=True, nullable=True)
	# user's Phira username
	phira_username = db.Column(db.String(32), nullable=True)
	# user's Phira rks
	phira_rks = db.Column(db.Float, nullable=True)
	# url to user's Phira avatar
	phira_avatar = db.Column(db.String(128), nullable=True)
	# user's register time
	register_time = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
	# when user logged in last time
	last_login_time = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
	# when user's Phira profile was synced last time
	last_sync_time = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

	@property
	def password(self):
		raise AttributeError("password is not a readable attribute")
	
	@password.setter
	def password(self, password: str) -> None:
		self.set_password(password)

	def set_password(self, password: str) -> None:
		self.password_hash = generate_password_hash(password)

	def check_password(self, password: str) -> bool:
		return check_password_hash(self.password_hash, password)
	
	def check_sync_time(self) -> bool:
		now = datetime.now(timezone.utc).replace(tzinfo=None)
		return (now - self.last_sync_time) >= timedelta(minutes=5)

	def update_login_time(self) -> None:
		self.last_login_time = datetime.now(timezone.utc)

	def update_sync_time(self) -> None:
		self.last_sync_time = datetime.now(timezone.utc)
	
	def has_permission(self, perm: Perm) -> bool:
		return (self.group.permissions & perm) == perm

	def to_dict(self) -> dict:
		return {
			"id": self.id,
			"group_id": self.group_id,
			"username": self.username,
			"phira_id": self.phira_id,
			"phira_username": self.phira_username,
			"phira_rks": self.phira_rks,
			"phira_avatar": self.phira_avatar,
			"register_time": self.register_time,
			"last_login_time": self.last_login_time,
			"last_sync_time": self.last_sync_time
		}


class Group(ModelInfoMixin, db.Model):
	__tablename__ = "groups"

	# group id
	id = db.Column(db.Integer, primary_key=True, autoincrement=True, nullable=False)
	# users in the group
	users = db.relationship("User", back_populates="group")
	# name of the group
	name = db.Column(db.String(32), unique=True, nullable=False)
	# bitmask of permissions
	permissions = db.Column(db.Integer, nullable=False)

	def has_permission(self, perm: Perm) -> bool:
		return (self.permissions & perm) == perm

	def to_dict(self) -> dict:
		return {
			"id": self.id,
			"users": [user.id for user in self.users] if self.users else [],
			"name": self.name,
			"permissions": self.permissions
		}


@lm.user_loader
def load_user(user_id):
	return User.query.get(int(user_id))
