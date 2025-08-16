from .extensions import db
from flask import abort, jsonify
from typing import Any


class ClientError(RuntimeError):
	def __init__(self, msg: str, code: int = 400) -> None:
		super().__init__(msg)
		self.code = code


class ModelInfoMixin:
	def update_from_dict(self, attrs: dict) -> None:
		for k, v in attrs.items():
			try:
				setattr(self, k, v)
			except AttributeError:
				pass
			except:
				raise


def check_request(req: dict|None,
				  required: list[tuple[str, type]],
				  optional: list[tuple[str, type]|tuple[str, type, Any]] = []) -> str|dict:
	if not req:
		return "invalid request"
	res = {}
	for k, v in required:
		if k not in req:
			raise ClientError(f"field '{k}' doesn't exist", 400)
		elif not isinstance(req[k], v):
			raise ClientError(f"field '{k}' must be {v.__name__}", 400)
		else:
			res[k] = req[k]
	for k, v, *rest in optional:
		if k not in req:
			if rest: res[k] = rest[0]
		elif not isinstance(req[k], v):
			raise ClientError(f"field '{k}' must be {v.__name__}", 400)
		else:
			res[k] = req[k]
	return res


def database_protect(func):
	def wrapper(*args, **kwargs):
		try:
			ret=func(*args, **kwargs)
			db.session.commit()
			return ret
		except:
			db.session.rollback()
			raise
	wrapper.__name__ = func.__name__
	return wrapper
