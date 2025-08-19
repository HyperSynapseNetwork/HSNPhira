import os

class DebugConfig:
    # secret key. use environment variable in production
    SECRET_KEY = "super-secret-key"
    # password for root user
    ROOT_PASSWORD = "super-secret-password"
    # path to phira-mp log processor
    PHIRA_LOG_PROCESSOR_PATH = ""

	# database configurations
    SQLALCHEMY_DATABASE_URI = "sqlite:///hsn_phira.db"
    SQLALCHEMY_TRACK_MODIFICATIONS = False


class ProductionConfig:
    SECRET_KEY = os.getenv("HSN_SECRET_KEY")
    ROOT_PASSWORD = os.getenv("HSN_ROOT_PASSWORD")

Config=DebugConfig
