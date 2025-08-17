from ..extensions import db, ma
from functools import lru_cache

class SchemaBase(ma.SQLAlchemySchema):
	class Meta:
		load_instance = False
		sqla_session = db.session
		include_relationships = True

def schema_factory(SchemaClass: type[SchemaBase]):
	@lru_cache(maxsize=None)
	def _get_schema(*args, **kwargs):
		return SchemaClass(*args, **kwargs)
	return _get_schema
