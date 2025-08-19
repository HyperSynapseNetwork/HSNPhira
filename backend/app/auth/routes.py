from ..extensions import db, lm
from .services import AuthService
from .schemas import user_schema, login_schema, group_schema
from flask import Blueprint, jsonify, request


class AuthAPI:
	def __init__(self) -> None:
		self._bp = Blueprint("auth", __name__, url_prefix="/auth")
		self._service = AuthService()

		self._bp.add_url_rule("/login", methods=["POST"], view_func=self.login)
		self._bp.add_url_rule("/logout", methods=["POST"], view_func=self.logout)
		self._bp.add_url_rule("/me", methods=["GET"], view_func=self.get_current_user_info)
		self._bp.add_url_rule("/users", methods=["POST"], view_func=self.create_user)
		self._bp.add_url_rule("/users", methods=["GET"], view_func=self.get_user_list)
		self._bp.add_url_rule("/users/<int:id>", methods=["GET"], view_func=self.get_user_info)
		self._bp.add_url_rule("/users/<int:id>", methods=["PATCH"], view_func=self.update_user_info)
		self._bp.add_url_rule("/users/<int:id>", methods=["DELETE"], view_func=self.delete_user)
		self._bp.add_url_rule("/groups", methods=["GET"], view_func=self.get_group_list)
		self._bp.add_url_rule("/groups", methods=["POST"], view_func=self.create_group)
		self._bp.add_url_rule("/groups/<int:id>", methods=["GET"], view_func=self.get_group_info)
		self._bp.add_url_rule("/groups/<int:id>", methods=["PATCH"], view_func=self.update_group_info)
		self._bp.add_url_rule("/groups/<int:id>", methods=["DELETE"], view_func=self.delete_group)

	def assign_to_app(self, app):
		app.register_blueprint(self._bp)

	def get_current_user_info(self):
		return jsonify(self._service.get_current_user_info())

	def create_user(self):
		data = user_schema().load(request.json)
		return jsonify(self._service.create_user(data))

	def login(self):
		data = login_schema().load(request.json)
		return jsonify(self._service.login(data))

	def logout(self):
		self._service.logout()
		return jsonify({"message": "goodbye"})

	def get_user_list(self):
		return jsonify(self._service.get_user_list())

	def get_user_info(self, id: int):
		return jsonify(self._service.get_user_info(id))

	def update_user_info(self, id: int):
		data = user_schema(partial=True).load(request.json)
		return jsonify(self._service.update_user_info(id, data))

	def delete_user(self, id: int):
		self._service.delete_user(id)
		return jsonify({"message": "success"})

	def get_group_list(self):
		return jsonify(self._service.get_group_list())

	def create_group(self):
		data = group_schema().load(request.json)
		return jsonify(self._service.create_group(data))

	def get_group_info(self, id: int):
		return jsonify(self._service.get_group_info(id))

	def update_group_info(self, id: int):
		data = group_schema(partial=True).load(request.json)
		return jsonify(self._service.update_group_info(id, data))

	def delete_group(self, id: int):
		self._service.delete_group(id)
		return jsonify({"message": "success"})
