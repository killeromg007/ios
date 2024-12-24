from flask import Flask, render_template, request, redirect, url_for, flash, jsonify
from flask_login import LoginManager, UserMixin, login_user, login_required, logout_user, current_user
from werkzeug.security import generate_password_hash, check_password_hash
import os
import json
from datetime import datetime
from dotenv import load_dotenv
import secrets
import string
import random
from pytz import timezone

load_dotenv()

# Ensure instance folder exists
INSTANCE_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'instance')
if not os.path.exists(INSTANCE_PATH):
    os.makedirs(INSTANCE_PATH)

# JSON file paths
USERS_FILE = os.path.join(INSTANCE_PATH, 'Users.json')
MESSAGES_FILE = os.path.join(INSTANCE_PATH, 'Messages.json')
LINKS_FILE = os.path.join(INSTANCE_PATH, 'links.json')
REPORTS_FILE = os.path.join(INSTANCE_PATH, 'reports.json')

# Create JSON files if they don't exist
for file_path in [USERS_FILE, MESSAGES_FILE, LINKS_FILE, REPORTS_FILE]:
    if not os.path.exists(file_path):
        with open(file_path, 'w') as f:
            json.dump([], f)

app = Flask(__name__)
app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', 'dev')

login_manager = LoginManager()
login_manager.init_app(app)
login_manager.login_view = 'login'

class User(UserMixin):
    def __init__(self, user_data):
        self.id = user_data['id']
        self.username = user_data['username']
        self.password_hash = user_data['password_hash']
        self.link = user_data.get('link')

def save_users(users):
    with open(USERS_FILE, 'w') as f:
        json.dump(users, f, indent=4)

def load_users():
    try:
        with open(USERS_FILE, 'r') as f:
            return json.load(f)
    except:
        return []

def save_messages(messages):
    with open(MESSAGES_FILE, 'w') as f:
        json.dump(messages, f, indent=4)

def load_messages():
    try:
        with open(MESSAGES_FILE, 'r') as f:
            return json.load(f)
    except:
        return []

def save_link(username, link):
    links = load_links()
    links.append({
        'username': username,
        'link': link,
        'created_at': datetime.utcnow().isoformat()
    })
    with open(LINKS_FILE, 'w') as f:
        json.dump(links, f, indent=4)

def load_links():
    try:
        with open(LINKS_FILE, 'r') as f:
            return json.load(f)
    except:
        return []

def save_reports(reports):
    with open(REPORTS_FILE, 'w') as f:
        json.dump(reports, f, indent=4)

def load_reports():
    try:
        with open(REPORTS_FILE, 'r') as f:
            return json.load(f)
    except:
        return []

def generate_unique_link():
    # Define character sets
    letters = string.ascii_letters  # a-z and A-Z
    digits = string.digits  # 0-9
    safe_chars = letters + digits + '-_'  # Safe URL characters
    
    while True:
        # Generate a random string of 10 characters
        link = ''.join(random.choices(safe_chars, k=10))
        
        # Check if link already exists
        existing_links = load_links()
        if not any(l['link'] == link for l in existing_links):
            return link

@login_manager.user_loader
def load_user(user_id):
    users = load_users()
    user_data = next((user for user in users if str(user['id']) == str(user_id)), None)
    if user_data:
        return User(user_data)
    return None

@app.route('/')
def index():
    if current_user.is_authenticated:
        messages = [msg for msg in load_messages() if msg['recipient_id'] == current_user.id]
        messages.sort(key=lambda x: x['timestamp'], reverse=True)
        return render_template('message_box.html', messages=messages)
    return render_template('index.html')

@app.route('/register', methods=['GET', 'POST'])
def register():
    if request.method == 'POST':
        username = request.form['username']
        password = request.form['password']
        
        users = load_users()
        
        if any(user['username'] == username for user in users):
            flash('Username already exists')
            return redirect(url_for('register'))
        
        link = generate_unique_link()
        
        new_user = {
            'id': len(users) + 1,
            'username': username,
            'password_hash': generate_password_hash(password),
            'link': link
        }
        
        users.append(new_user)
        save_users(users)
        save_link(username, link)
        
        flash('Registration successful')
        return redirect(url_for('login'))
    
    return render_template('register.html')

@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        username = request.form['username']
        password = request.form['password']
        
        users = load_users()
        user_data = next((user for user in users if user['username'] == username), None)
        
        if user_data and check_password_hash(user_data['password_hash'], password):
            user = User(user_data)
            login_user(user)
            flash('Logged in successfully')
            return redirect(url_for('index'))
        
        flash('Invalid username or password')
    return render_template('login.html')

@app.route('/logout')
@login_required
def logout():
    logout_user()
    flash('Logged out successfully')
    return redirect(url_for('index'))

@app.route('/send_message', methods=['GET', 'POST'])
def send_message():
    if request.method == 'POST':
        recipient_username = request.form['recipient']
        content = request.form['content']
        
        users = load_users()
        recipient = next((user for user in users if user['username'] == recipient_username), None)
        
        if not recipient:
            flash('Recipient not found')
            return redirect(url_for('send_message'))
        
        messages = load_messages()
        new_message = {
            'id': len(messages) + 1,
            'content': content,
            'timestamp': datetime.utcnow().isoformat(),
            'recipient_id': recipient['id'],
            'is_anonymous': not current_user.is_authenticated
        }
        
        messages.append(new_message)
        save_messages(messages)
        
        flash('Message sent successfully')
        return redirect(url_for('index'))
    
    users = load_users()
    return render_template('send_message.html', users=users)

@app.route('/message_box')
@login_required
def message_box():
    messages = [msg for msg in load_messages() if msg['recipient_id'] == current_user.id]
    messages.sort(key=lambda x: x['timestamp'], reverse=True)
    return render_template('message_box.html', messages=messages)

@app.route('/l/<link>')
def redirect_to_message(link):
    """Redirect short links to the message form"""
    return redirect(url_for('send_anonymous_message', link=link))

def get_client_ip():
    """Get client IP address, handling proxies"""
    if request.headers.getlist("X-Forwarded-For"):
        return request.headers.getlist("X-Forwarded-For")[0]
    return request.remote_addr

@app.route('/message/<link>', methods=['GET', 'POST'])
def send_anonymous_message(link):
    users = load_users()
    user = next((user for user in users if user.get('link') == link), None)
    
    if not user:
        flash('Invalid link')
        return redirect(url_for('index'))
    
    if request.method == 'POST':
        content = request.form['content']
        ip_address = get_client_ip()
        
        messages = load_messages()
        new_message = {
            'id': len(messages) + 1,
            'content': content,
            'timestamp': datetime.utcnow().isoformat(),
            'recipient_id': user['id'],
            'is_anonymous': True,
            'created_at': datetime.utcnow().isoformat()
        }
        
        # Store IP and user agent in reports file
        reports = load_reports()
        reports.append({
            'message_id': new_message['id'],
            'ip_address': ip_address,
            'user_agent': request.headers.get('User-Agent'),
            'created_at': datetime.utcnow().isoformat()
        })
        
        messages.append(new_message)
        save_messages(messages)
        save_reports(reports)
        
        flash('Message sent successfully!')
        return redirect(url_for('send_anonymous_message', link=link))
    
    return render_template('anonymous_message.html', username=user['username'])

@app.route('/report_message/<int:message_id>', methods=['POST'])
@login_required
def report_message(message_id):
    messages = load_messages()
    message = next((m for m in messages if m['id'] == message_id), None)
    
    if message and message['recipient_id'] == current_user.id:
        # Get IP info from reports
        reports = load_reports()
        message_report = next((r for r in reports if r['message_id'] == message_id), None)
        
        # Create new report
        new_report = {
            'message_id': message_id,
            'reporter_id': current_user.id,
            'reported_at': datetime.utcnow().isoformat(),
            'message_content': message['content']
        }
        
        # Add IP info if available
        if message_report:
            new_report['sender_ip'] = message_report['ip_address']
            new_report['user_agent'] = message_report['user_agent']
        
        reports.append(new_report)
        save_reports(reports)
        
        return jsonify({'success': True})
    
    return jsonify({'success': False}), 403

@app.route('/generate_new_link', methods=['POST'])
@login_required
def generate_new_link():
    users = load_users()
    user = next((u for u in users if u['id'] == current_user.id), None)
    
    if user:
        new_link = generate_unique_link()
        user['link'] = new_link
        save_users(users)
        save_link(user['username'], new_link)
        return jsonify({'success': True})
    
    return jsonify({'success': False}), 404

def format_datetime(timestamp):
    """Convert ISO timestamp to readable format"""
    dt = datetime.fromisoformat(timestamp)
    local_tz = timezone('Asia/Taipei')  # Change to your timezone
    local_dt = dt.astimezone(local_tz)
    return local_dt.strftime('%Y-%m-%d %H:%M')

app.jinja_env.filters['datetime'] = format_datetime

port = int(os.getenv('PORT', 8080))
host = os.getenv('HOST', '0.0.0.0')

if __name__ == '__main__':
    if os.getenv('FLASK_DEBUG', 'False') == 'True':
        app.run(debug=True)
    else:
        app.run(host=host, port=port)
