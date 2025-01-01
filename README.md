# Anonymous Messages App

A web application that allows users to send and receive anonymous messages.

## Features
- User registration and authentication
- Anonymous message boxes
- Modern UI design

## Local Development
1. Install dependencies:
```bash
# Install Python dependencies
pip install -r requirements.txt

# Install Node.js dependencies
npm install
```

2. Set up environment variables in `.env`:
```
SECRET_KEY=[your-secret-key]
DATABASE_URL=[your-database-url]
```

3. Run the application:
```bash
# Start the Node.js server (which will start Flask)
npm start
```

## Deployment (Render)

1. Push your code to GitHub

2. In Render:
   - Connect your repository
   - Environment: Node.js
   - Build Command: `npm install && pip install -r requirements.txt`
   - Start Command: `npm start`
   - Add environment variables:
     ```
     SECRET_KEY=[your-secret-key]
     DATABASE_URL=[your-database-url]
     HOST=0.0.0.0
     PORT=8080
     ```

3. Deploy!
