from flask_sqlalchemy import SQLAlchemy
from flask_login import LoginManager
from flask_marshmallow import Marshmallow
from flask_migrate import Migrate

db = SQLAlchemy()
lm = LoginManager()
ma = Marshmallow()
migrate = Migrate()
