from flask import Blueprint, redirect, url_for, session, request, flash
from requests_oauthlib import OAuth2Session
from flask_login import login_user
import os
import json

auth = Blueprint('auth', __name__)

# Load configuration
GOOGLE_CLIENT_ID = os.getenv('GOOGLE_OAUTH_CLIENT_ID')
GOOGLE_CLIENT_SECRET = os.getenv('GOOGLE_OAUTH_CLIENT_SECRET')
GOOGLE_AUTHORIZE_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"

# Load users from JSON file
def load_users():
    users_file = os.path.join('instance', 'Users.json')
    try:
        with open(users_file, 'r') as f:
            return json.load(f)
    except:
        return []

def save_users(users):
    users_file = os.path.join('instance', 'Users.json')
    with open(users_file, 'w') as f:
        json.dump(users, f, indent=4)

@auth.route('/login')
def login():
    google = OAuth2Session(
        GOOGLE_CLIENT_ID,
        scope=['openid', 'email', 'profile'],
        redirect_uri=url_for('auth.callback', _external=True)
    )
    authorization_url, state = google.authorization_url(GOOGLE_AUTHORIZE_URL)
    session['oauth_state'] = state
    return redirect(authorization_url)

@auth.route('/callback')
def callback():
    google = OAuth2Session(
        GOOGLE_CLIENT_ID,
        state=session['oauth_state'],
        redirect_uri=url_for('auth.callback', _external=True)
    )
    
    token = google.fetch_token(
        GOOGLE_TOKEN_URL,
        client_secret=GOOGLE_CLIENT_SECRET,
        authorization_response=request.url
    )
    
    # Get user info from Google
    user_info = google.get('https://www.googleapis.com/oauth2/v1/userinfo').json()
    
    # Load existing users
    users = load_users()
    
    # Check if user exists
    user_data = next(
        (user for user in users if user['email'] == user_info['email']), 
        None
    )
    
    if not user_data:
        # Create new user
        user_data = {
            'id': len(users) + 1,
            'username': user_info['email'].split('@')[0],  # Use email prefix as username
            'email': user_info['email'],
            'password_hash': None  # Google OAuth users don't need password
        }
        users.append(user_data)
        save_users(users)
    
    # Create User object and log in
    from app import User  # Import here to avoid circular import
    user = User(user_data)
    login_user(user)
    flash('Logged in successfully with Google')
    
    return redirect(url_for('index')) 