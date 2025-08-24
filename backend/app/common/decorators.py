from ..extensions import db
from flask import current_app
from functools import wraps

def database_guard(func):
	@wraps(func)
	def wrapper(*args, **kwargs):
		try:
			ret=func(*args, **kwargs)
			db.session.commit()
			return ret
		except:
			db.session.rollback()
			raise
	return wrapper

def appcontext_guard(func):
	@wraps(func)
	def wrapper(*args, **kwargs):
		with current_app.app_context():
			return func(*args, **kwargs)
	return wrapper
