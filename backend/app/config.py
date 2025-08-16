import os

class DebugConfig:
    # secret key. use environment variable in production
    SECRET_KEY = "super-secret-key"

	# database configurations
    SQLALCHEMY_DATABASE_URI = "sqlite:///hsn_phira.db"
    SQLALCHEMY_TRACK_MODIFICATIONS = False


class ProductionConfig:
    SECRET_KEY = os.getenv("HSN_SECRET_KEY")

Config=DebugConfig
