from ..extensions import db, lm
from . import Permission

from flask_login import UserMixin
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import datetime, timedelta, timezone

class User(UserMixin, db.Model):
	__tablename__ = "users"

	# user id
	id = db.Column(db.Integer, primary_key=True, autoincrement=True, nullable=False)
	# user's group id
	group_id = db.Column(db.Integer, db.ForeignKey("groups.id"), nullable=False)
	# user's group
	group = db.relationship("Group", back_populates="_users")
	# username
	username = db.Column(db.String(32), unique=True, nullable=False)
	# user's Phira id
	phira_id = db.Column(db.Integer, unique=True, nullable=True)
	# user's Phira username
	phira_username = db.Column(db.String(32), nullable=True)
	# user's Phira rks
	phira_rks = db.Column(db.Float, nullable=True)
	# url to user's Phira avatar
	phira_avatar = db.Column(db.String(128), nullable=True)
	# user's register time
	register_time = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
	# when user logged in last time
	last_login_time = db.Column(db.DateTime, nullable=True)
	# when user's Phira profile was synced last time
	last_sync_time = db.Column(db.DateTime, nullable=True)
	# hash of user's password
	password_hash = db.Column(db.String(128), nullable=False)

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
		if not self.last_sync_time:
			return True
		now = datetime.now(timezone.utc).replace(tzinfo=None)
		return (now - self.last_sync_time) >= timedelta(minutes=5)

	def update_login_time(self) -> None:
		self._last_login_time = datetime.now(timezone.utc)
	
	def update_sync_time(self) -> None:
		self.last_sync_time = datetime.now(timezone.utc)

	def has_permission(self, perm: Permission) -> bool:
		return (self.group.permissions & perm) == perm


class Group(db.Model):
	__tablename__ = "groups"

	# group id
	id = db.Column(db.Integer, primary_key=True, autoincrement=True, nullable=False)
	# users in the group
	_users = db.relationship("User", back_populates="group")
	# name of the group
	name = db.Column(db.String(32), unique=True, nullable=False)
	# bitmask of permissions
	permissions = db.Column(db.Integer, nullable=False)

	@property
	def users(self):
		return [user.id for user in self._users] if self._users else []

	def has_permission(self, perm: Permission) -> bool:
		return (self.permissions & perm) == perm


class Visited(db.Model):
	__tablename__ = "visited"

	phira_id = db.Column(db.Integer, primary_key=True, nullable=False)


@lm.user_loader
def load_user(user_id):
	return User.query.get(int(user_id))
