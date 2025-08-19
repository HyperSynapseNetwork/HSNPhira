from .service import RoomsService
from flask import Blueprint, Response, jsonify
from flask_login import login_required


class RoomsAPI:
	def __init__(self):
		self._bp = Blueprint("rooms", __name__, url_prefix="/rooms")
		self._service = RoomsService()

		self._bp.add_url_rule("/info", methods=["GET"], view_func=self.get_rooms)
		self._bp.add_url_rule("/info/<string:name>", methods=["GET"], view_func=self.get_room)
		self._bp.add_url_rule("/user/<int:user_id>", methods=["GET"], view_func=self.get_users_room)
		self._bp.add_url_rule("/listen", methods=["GET"], view_func=self.listen)
	
	def assign_to_app(self, app):
		app.register_blueprint(self._bp)
	
	@login_required
	def get_rooms(self):
		return jsonify(self._service.get_rooms())

	@login_required
	def get_room(self, name):
		return jsonify(self._service.get_room(name))

	@login_required
	def get_users_room(self, user_id):
		return jsonify(self._service.get_users_room(user_id))
	
	@login_required
	def listen(self):
		return Response(self._service.new_listener(), mimetype="text/event-stream")
