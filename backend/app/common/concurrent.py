from concurrent.futures import ThreadPoolExecutor
from functools import wraps
import threading

executor = ThreadPoolExecutor(max_workers=5)
exit_event = threading.Event()

def executor_guard(func):
	@wraps(func)
	def wrapper(*args, **kwargs):
		try:
			return func(*args, **kwargs)
		finally:
			exit_event.set()
			executor.shutdown()
	return wrapper
