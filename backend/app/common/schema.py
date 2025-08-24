from ..extensions import db, ma

from functools import lru_cache

def schema_factory(SchemaClass):
	@lru_cache(maxsize=None)
	def _get_schema(*args, **kwargs):
		return SchemaClass(*args, **kwargs)
	return _get_schema
