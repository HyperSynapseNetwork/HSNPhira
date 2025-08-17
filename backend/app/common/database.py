from ..extensions import db
from functools import wraps

def database_protect(func):
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
