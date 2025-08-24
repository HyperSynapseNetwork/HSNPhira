import os

class Config:
	# whether to run in debug mode
	DEBUG = os.getenv("HSN_DEBUG", False)
	# host
	HOST = os.getenv("HSN_BACKEND_HOST", "0.0.0.0")
	# port
	PORT = int(os.getenv("HSN_BACKEND_PORT", "5000"))
	# directory to put log files
	LOGDIR = os.getenv("HSN_LOGDIR")
	# secret key. use environment variable in production
	SECRET_KEY = os.getenv("HSN_SECRET_KEY", "super-secret-key")
	# password for root user
	ROOT_PASSWORD = os.getenv("HSN_ROOT_PASSWORD", "super-secret-password")
	# path to phira-mp log processor
	LOG_PROCESSOR_PIPE = os.getenv("HSN_LOG_PROCESSOR_PIPE", "test/log_processor.pipe")
	# whether to require user has played in server before register
	STRICT_REGISTRATION = (os.getenv("HSN_STRICT_REGISTRATION") is not None)
	# database configurations
	SQLALCHEMY_DATABASE_URI = os.getenv("HSN_DATABASE_URI", "sqlite:///hsn_phira.db")
	SQLALCHEMY_TRACK_MODIFICATIONS = False
