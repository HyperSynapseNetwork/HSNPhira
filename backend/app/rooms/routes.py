from .services import RoomsService

from flask import Blueprint, Response, jsonify


class RoomsAPI:
	def __init__(self, app):
		self._bp = Blueprint("rooms", __name__, url_prefix="/api/rooms")
		self._service = RoomsService(app)

		self._bp.add_url_rule("/info", methods=["GET"], view_func=self.get_rooms)
		self._bp.add_url_rule("/info/<string:name>", methods=["GET"], view_func=self.get_room)
		self._bp.add_url_rule("/user/<int:user_id>", methods=["GET"], view_func=self.get_users_room)
		self._bp.add_url_rule("/listen", methods=["GET"], view_func=self.listen)
		
		app.register_blueprint(self._bp)

	def get_rooms(self):
		return jsonify(self._service.get_rooms())

	def get_room(self, name):
		return jsonify(self._service.get_room(name))

	def get_users_room(self, user_id):
		return jsonify(self._service.get_users_room(user_id))

	def listen(self):
		return Response(self._service.new_listener(), mimetype="text/event-stream")
