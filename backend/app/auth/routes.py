from ..extensions import db, lm
from ..common import ClientError, check_request
from .services import AuthService
from flask import Blueprint, request, jsonify
from flask_login import login_required


class AuthAPI:
	def __init__(self) -> None:
		self._bp = Blueprint("auth", __name__, url_prefix="/auth")
		self._service = AuthService()

		self._bp.add_url_rule("/register", methods=["POST"], view_func=self.register)
		self._bp.add_url_rule("/login", methods=["POST"], view_func=self.login)
		self._bp.add_url_rule("/logout", methods=["POST"], view_func=self.logout)
		self._bp.add_url_rule("/users", methods=["GET"], view_func=self.get_user_list)
		self._bp.add_url_rule("/users/<int:id>", methods=["GET"], view_func=self.get_user_profile)
		self._bp.add_url_rule("/users/<int:id>", methods=["PATCH"], view_func=self.update_user_profile)
		self._bp.add_url_rule("/users/<int:id>", methods=["DELETE"], view_func=self.delete_user)
		self._bp.add_url_rule("/groups", methods=["GET"], view_func=self.get_group_list)
		self._bp.add_url_rule("/groups/<int:id>", methods=["GET"], view_func=self.get_group_info)
		self._bp.add_url_rule("/groups/<int:id>", methods=["PATCH"], view_func=self.update_group_info)
		self._bp.add_url_rule("/groups/<int:id>", methods=["DELETE"], view_func=self.delete_group)

	def assign_to_app(self, app):
		app.register_blueprint(self._bp)

	def register(self):
		data = check_request(
			request.json,
			[("username", str), ("password", str), ("phira_id", int)]
		) 
		if isinstance(data, str):
			return jsonify({"error": data}), 400

		return self._service.create_user(**data, group_id=3).to_dict()

	def login(self):
		data = check_request(
			request.json,
			[("username", str), ("password", str)],
			[("remember", bool, True)]
		)
		if isinstance(data, str):
			return jsonify({"error": data}), 400

		return self._service.login(**data).to_dict()

	def logout(self):
		self._service.logout()
		return jsonify({"message": "goodbye"})

	def get_user_list(self):
		return jsonify(self._service.get_user_list())

	def get_user_profile(self, id: int):
		return jsonify(self._service.get_user_profile(id))

	def update_user_profile(self, id: int):
		data = check_request(
			request.json, [],
			[("group_id", int), ("username", str), ("password", str), ("phira_id", int)]
		)
		if isinstance(data, str):
			return jsonify({"error": data}), 400
		self._service.update_user_profile(id, data)
		return jsonify({"message": "success"})

	def delete_user(self, id: int):
		self._service.delete_user(id)
		return jsonify({"message": "success"})

	def get_group_list(self):
		return jsonify(self._service.get_group_list())

	def get_group_info(self, id: int):
		return jsonify(self._service.get_group_info(id))

	def update_group_info(self, id: int):
		data = check_request(
			request.json, [],
			[("name", str), ("permissions", int)]
		)
		if isinstance(data, str):
			return jsonify({"error": data}), 400

		self._service.update_group_info(id, data)
		return jsonify({"message": "success"})

	def delete_group(self, id: int):
		self._service.delete_group(id)
		return jsonify({"message": "success"})
