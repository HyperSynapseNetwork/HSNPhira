from . import cli
from .extensions import db
from .common.error import ClientError
from .config import Config
from .extensions import db, lm, ma, migrate
from .auth.routes import AuthAPI
from .rooms.routes import RoomsAPI

from flask import Flask, jsonify
from marshmallow import ValidationError
import logging
from logging.handlers import RotatingFileHandler
from concurrent.futures import ThreadPoolExecutor
from threading import Event
from functools import wraps

class HSNApplication(Flask):
	def __init__(self, *args, **kwargs):
		super().__init__(*args, **kwargs)
		self.config.from_object(Config)

		# thread pool
		self._executor = ThreadPoolExecutor(max_workers=5)
		self._exit_event = Event()
		self._tasks = []

		# error handlers
		self.register_error_handler(Exception, self.on_exception)
		self.register_error_handler(ClientError, self.on_client_error)
		self.register_error_handler(ValidationError, self.on_validation_error)
		self.register_error_handler(400, self.on_400)
		self.register_error_handler(401, self.on_401)
		self.register_error_handler(403, self.on_403)
		self.register_error_handler(404, self.on_404)

		# logging
		if (logdir := Config.LOGDIR):
			formatter = logging.Formatter("%(asctime)s %(levelname)s %(name)s: %(message)s")
			file_handler = RotatingFileHandler(logdir + "/hsn_backend.log", maxBytes=1024*1024, backupCount=10)
			file_handler.setFormatter(formatter)
			stream_handler = logging.StreamHandler()
			stream_handler.setFormatter(formatter)

			werkzeug_logger = logging.getLogger('werkzeug')
			werkzeug_logger.addHandler(file_handler)
			self.logger.addHandler(file_handler)
			self.logger.setLevel(logging.DEBUG if Config.DEBUG else logging.INFO)

		# cli commands
		self.cli.add_command(cli.init_db)
	
		# blueprints
		self.auth_api = AuthAPI(self)
		self.rooms_api = RoomsAPI(self)
		self.auth_api.setup()
		self.rooms_api.setup()

	def register_task(self, func, *args, **kwargs):
		@wraps(func)
		def wrapped():
			with self.app_context():
				return func(self._exit_event, *args, **kwargs)
		self._tasks.append(wrapped)

	def run(self, *args, **kwargs):
		try:
			for task in self._tasks:
				self._executor.submit(task)
			return super().run(*args, **kwargs)
		finally:
			self._exit_event.set()
			self._executor.shutdown()

	def on_exception(self, e):
		return jsonify({"error": repr(e)}), 500
	
	def on_client_error(self, e):
		return jsonify({"error": e.args[0]}), e.code
	
	def on_validation_error(self, e):
		msg = ", ".join([f"{k}: {v}" for k, v in e.normalized_messages().items()])
		return jsonify({"error": msg}), 400

	def on_400(self, e):
		return jsonify({"error": "bad request"}), 400

	def on_401(self, e):
		return jsonify({"error": "unauthorized"}), 401

	def on_403(self, e):
		return jsonify({"error": "forbidden"}), 403

	def on_404(self, e):
		return jsonify({"error": "not found"}), 404

def create_app():
	# create app object
	app = HSNApplication("HSNPhira")

	# initialize extensions
	db.init_app(app)
	lm.init_app(app)
	ma.init_app(app)
	migrate.init_app(app, db)

	return app
