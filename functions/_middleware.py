from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from flask_login import LoginManager
from .auth import auth
import os

app = Flask(__name__, 
    static_folder='../static',
    template_folder='../templates'
)

app.config['SECRET_KEY'] = os.getenv('SECRET_KEY')
app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv('DATABASE_URL')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['SERVER_NAME'] = os.getenv('DOMAIN')  # Your custom domain

db = SQLAlchemy(app)
login_manager = LoginManager()
login_manager.init_app(app)
login_manager.login_view = 'auth.login'

app.register_blueprint(auth)

def handler(request):
    """Handle incoming requests."""
    with app.request_context(request):
        return app.handle_request()