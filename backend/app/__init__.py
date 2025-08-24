from . import cli
from .extensions import db
from .common import ClientError, executor, exit_event, executor_guard
from .config import Config
from .extensions import db, lm, ma
from .auth.routes import AuthAPI
from .rooms.routes import RoomsAPI

from flask import Flask, jsonify
from marshmallow import ValidationError
import logging
from logging.handlers import RotatingFileHandler
import click


def create_app():
	# create Flask object
	app = Flask("HSNPhira")
	app.config.from_object(Config)

	# initialize extensions
	db.init_app(app)
	lm.init_app(app)
	ma.init_app(app)

	# error handlers
	app.register_error_handler(Exception, lambda e: (jsonify({"error": repr(e)}), 500))
	app.register_error_handler(ClientError, lambda e: (jsonify({"error": e.args[0]}), e.code))
	app.register_error_handler(ValidationError, lambda e: (jsonify({
		"error": ", ".join([f"{k}: {v}" for k, v in e.messages().items()])
	}), 400))
	app.register_error_handler(400, lambda e: (jsonify({"error": "bad request"}), 400))
	app.register_error_handler(403, lambda e: (jsonify({"error": "forbidden"}), 403))
	app.register_error_handler(404, lambda e: (jsonify({"error": "not found"}), 404))

	# logging
	if (logdir := Config.LOGDIR):
		handler = RotatingFileHandler(logdir + "/hsn_backend.log", maxBytes=1024*1024, backupCount=10)
		formatter = logging.Formatter("%(asctime)s %(levelname)s %(name)s: %(message)s")
		handler.setFormatter(formatter)

		app.logger.addHandler(handler)
		werkzeug_logger = logging.getLogger('werkzeug')
		werkzeug_logger.addHandler(handler)

	# blueprints
	auth_api = AuthAPI(app)
	rooms_api = RoomsAPI(app)

	# cli commands
	app.cli.add_command(cli.init_db)

	return app
