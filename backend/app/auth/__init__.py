from ..common import ClientError
from flask_login import current_user
from contextlib import contextmanager
from functools import wraps
from enum import IntFlag


class Permission(IntFlag):
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

	def to_list(self) -> list[str]:
		return [perm.name for perm in Permission if perm in self]


def ensure_perm(perm: Permission):
	if not current_user or not current_user.is_authenticated:
		raise ClientError("unauthenticated", 401)
	if not current_user.group or not current_user.has_permission(perm):
		raise ClientError(f"permission denied (requires: {", ".join(perm.to_list())})", 403)


def ensure_super_admin():
	if not current_user or not current_user.is_authenticated:
		raise ClientError("unauthenticated", 401)
	if current_user.id != 1:
		raise ClientError("permission denied (requires super admin)", 403)
