from flask import Flask, jsonify
from .auth.routes import AuthAPI
from .auth.services import AuthService
from .extensions import db, lm, migrate
from .config import Config
from .common import ClientError

def create_app():
	# create app object
	app = Flask(__name__)
	app.config.from_object(Config)

	# initialize extensions
	db.init_app(app)
	lm.init_app(app)
	migrate.init_app(app, db)

	# error handlers
	app.register_error_handler(Exception, lambda e: (repr(e), 500))
	app.register_error_handler(ClientError, lambda e: (jsonify({"error": e.args[0]}), e.code))
	app.register_error_handler(404, lambda e: (jsonify({"error": "not found"}), 404))
	app.register_error_handler(401, lambda e: (jsonify({"error": "unauthorized"}), 401))

	# blueprints
	auth_api = AuthAPI()
	auth_api.assign_to_app(app)

	# commands
	@app.cli.command("seed_db")
	def seed_db():
		AuthService.seed_db()

	# ensure db is created
	with app.app_context():
		db.create_all()

	return app