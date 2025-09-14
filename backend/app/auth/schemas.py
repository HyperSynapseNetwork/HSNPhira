from ..extensions import ma
from ..common.decorators import singleton
from .models import User, Group, Visited


@singleton
class CreateUserSchema(ma.SQLAlchemySchema):
	class Meta:
		model = User
	username = ma.auto_field(required=True)
	phira_id_or_username = ma.String(required=True)
	group_id = ma.auto_field(required=False, load_default=3)
	password = ma.String(required=True)


@singleton
class GetUserSchema(ma.SQLAlchemyAutoSchema):
	class Meta:
		model = User
		include_fk = True
		exclude = ["password_hash"]


@singleton
class UpdateUserSchema(ma.SQLAlchemySchema):
	class Meta:
		model = User
	current_password = ma.String(required=True)
	group_id = ma.auto_field(required=False)
	username = ma.auto_field(required=False)
	phira_id = ma.auto_field(required=False)
	password = ma.String(required=False)


@singleton
class LoginSchema(ma.Schema):
	username = ma.String(required=True)
	password = ma.String(required=True)
	remember = ma.Boolean(required=False, load_default=True)


@singleton
class CreateGroupSchema(ma.SQLAlchemySchema):
	class Meta:
		model = Group
	name = ma.auto_field(required=True)
	permissions = ma.auto_field(required=True)


@singleton
class GetGroupSchema(ma.SQLAlchemyAutoSchema):
	class Meta:
		model = Group
	users = ma.List(ma.Integer())


@singleton
class UpdateGroupSchema(ma.SQLAlchemySchema):
	class Meta:
		model = Group
	current_password = ma.String(required=True)
	name = ma.auto_field(required=False)
	permissions = ma.auto_field(required=False)


@singleton
class VisitedSchema(ma.SQLAlchemyAutoSchema):
	class Meta:
		model = Visited
