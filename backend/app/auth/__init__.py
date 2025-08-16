from ..common import ClientError
from flask_login import current_user
from contextlib import contextmanager
from functools import wraps
from enum import IntFlag


class Perm(IntFlag):
	# no permission
	NONE = 0
	# all permissions
	ALL = 0xffffffff
	# user cannot be deleted except by super-admin
	IMPORTANT = 0x00000001
	# has user management permission
	USER_MANAGEMENT = 0x00000002
	# has group management permission
	GROUP_MANAGEMENT = 0x00000004


@contextmanager
def perm_required_context(perms: Perm):
	if not current_user.is_authenticated:
		raise ClientError("unauthenticated", 401)
	if not current_user.group or (current_user.group.permissions&perms) != perms:
		raise ClientError("permission denied", 403)
	yield None

def perm_required(perm: Perm):
	def decorator(func):
		@wraps(func)
		def wrapper(*args, **kwargs):
			with perm_required_context(perm):
				return func(*args, **kwargs)
		return wrapper
	return decorator


@contextmanager
def super_admin_required_context():
	if not current_user.is_authenticated:
		raise ClientError("unauthenticated", 401)
	if current_user.id != 1:
		raise ClientError("permission denied", 403)
	yield None

def super_admin_required(func):
	@wraps(func)
	def wrapper(*args, **kwargs):
		with super_admin_required_context():
			return func(*args, **kwargs)
	return wrapper
