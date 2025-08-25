from .extensions import db
from .config import Config
from .common.decorators import database_guard
from .auth.models import User, Group
from .auth import Permission

import click
from flask import current_app as app
from flask.cli import with_appcontext

@click.command("init-db")
@with_appcontext
@database_guard
def init_db():
	db.drop_all()
	db.create_all()
	
	default_groups=[
		{"name": "root", "permissions": Permission.ALL},
		{"name": "admin", "permissions": Permission.IMPORTANT|Permission.USER_MANAGEMENT},
		{"name": "user", "permissions": Permission.NONE}
	]
	default_users=[
		{"username": "root", "password": Config.ROOT_PASSWORD, "group_id": 1}
	]
	for kwargs in default_groups:
		db.session.add(Group(**kwargs))
	for kwargs in default_users:
		db.session.add(User(**kwargs))
