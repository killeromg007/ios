from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from flask_login import LoginManager
from auth import auth
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
    # Use environment variables for production settings
    port = int(os.getenv('PORT', 8080))
    host = os.getenv('HOST', '0.0.0.0')
    debug = os.getenv('FLASK_DEBUG', 'False') == 'True'
    
    app.run(host=host, port=port, debug=debug)
