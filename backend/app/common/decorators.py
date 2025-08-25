from ..extensions import db
from functools import wraps, lru_cache
from typing import TypeVar


_T = TypeVar("_T")


def database_guard(func):
	@wraps(func)
	def wrapper(*args, **kwargs):
		try:
			ret=func(*args, **kwargs)
			db.session.commit()
			return ret
		except:
			db.session.rollback()
			raise
	return wrapper


def singleton(cls: type[_T]) -> type[_T]:
	class SingletonMeta(type(cls)):
		def __init__(meta, name, bases, dct):
			super().__init__(name, bases, dct)

			@lru_cache
			def __new(meta, *args, **kwargs):
				return type.__call__(meta, *args, **kwargs)
			meta.__new = __new

		def __call__(meta, *args, **kwargs):
			return meta.__new(meta, *args, **kwargs)

	NewCls = SingletonMeta(cls.__name__, (cls, ), {})
	NewCls.__module__ = cls.__module__
	NewCls.__doc__ = cls.__doc__
	NewCls.__qualname__ = cls.__qualname__
	return NewCls
