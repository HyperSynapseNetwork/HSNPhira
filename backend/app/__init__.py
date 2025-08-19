from .auth.routes import AuthAPI
from .extensions import db, lm, ma
from .config import Config
from .common import ClientError
from flask import Flask, jsonify
from marshmallow import ValidationError

def create_app():
	# create app object
	app = Flask(__name__)
	app.config.from_object(Config)

	# initialize extensions
	db.init_app(app)
	lm.init_app(app)
	ma.init_app(app)

	# error handlers
	app.register_error_handler(Exception, lambda e: (repr(e), 500))
	app.register_error_handler(ValidationError, lambda e: (jsonify({"error": f"{e.normalized_messages()}"}), 400))
	app.register_error_handler(ClientError, lambda e: (jsonify({"error": e.args[0]}), e.code))
	app.register_error_handler(400, lambda e: (jsonify({"error": "bad request"}), 400))
	app.register_error_handler(401, lambda e: (jsonify({"error": "unauthorized"}), 401))
	app.register_error_handler(404, lambda e: (jsonify({"error": "not found"}), 404))

	# blueprints
	auth_api = AuthAPI()
	auth_api.assign_to_app(app)

	# commands
	@app.cli.command("seed_db")
	def seed_db():
		import auth.models
		auth.models.seed_db()

	# ensure db is created
	with app.app_context():
		db.create_all()

	return app