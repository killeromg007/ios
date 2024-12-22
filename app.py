from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from flask_login import LoginManager
from auth import auth  # Import our new auth blueprint
import os

app = Flask(__name__)
app.config['SECRET_KEY'] = os.getenv('SECRET_KEY')
app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv('DATABASE_URL')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app)
login_manager = LoginManager()
login_manager.init_app(app)
login_manager.login_view = 'auth.login'

# Register the auth blueprint
app.register_blueprint(auth)

if __name__ == '__main__':
    app.run(debug=True)
