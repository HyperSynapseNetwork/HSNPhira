from ..extensions import ma
from ..common import SchemaBase, schema_factory
from .models import User, Group

class UserSchema(SchemaBase):
	class Meta(SchemaBase.Meta):
		model = User

	id = ma.auto_field(dump_only=True)
	group_id = ma.auto_field(required=False, load_default=3)
	username = ma.auto_field(required=True)
	phira_id = ma.auto_field(required=True)
	password = ma.String(load_only=True, required=True)
	phira_username = ma.auto_field(dump_only=True)
	phira_rks = ma.auto_field(dump_only=True)
	phira_avatar = ma.auto_field(dump_only=True)
	register_time = ma.auto_field(dump_only=True)
	last_login_time = ma.auto_field(dump_only=True)
	last_sync_time = ma.auto_field(dump_only=True)

class LoginSchema(ma.Schema):
	username = ma.String(required=True)
	password = ma.String(required=True)
	remember = ma.Boolean(required=False, load_default=True)

class GroupSchema(SchemaBase):
	class Meta(SchemaBase.Meta):
		model = Group

	id = ma.auto_field(dump_only=True)
	name = ma.auto_field(required=True)
	permissions = ma.auto_field(required=True)
	users = ma.List(ma.Integer(), dump_only=True)


user_schema = schema_factory(UserSchema)
login_schema = schema_factory(LoginSchema)
group_schema = schema_factory(GroupSchema)
