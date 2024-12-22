from flask import Blueprint, redirect, url_for, session, request
from requests_oauthlib import OAuth2Session
import os

auth = Blueprint('auth', __name__)

GOOGLE_CLIENT_ID = os.getenv('GOOGLE_OAUTH_CLIENT_ID')
GOOGLE_CLIENT_SECRET = os.getenv('GOOGLE_OAUTH_CLIENT_SECRET')
GOOGLE_AUTHORIZE_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"

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
    user_info = google.get('https://www.googleapis.com/oauth2/v1/userinfo').json()
    # Handle user login/registration here
    return redirect(url_for('index')) 