# Anonymous Messages App

A web application that allows users to send and receive anonymous messages.

## Features
- User registration and authentication
- Google OAuth login
- Anonymous message boxes
- Modern UI design

## Local Development
1. Install dependencies:
```bash
pip install -r requirements.txt
```

2. Set up environment variables in `.env`:
```
SECRET_KEY=[your-secret-key]
GOOGLE_OAUTH_CLIENT_ID=[your-google-client-id]
GOOGLE_OAUTH_CLIENT_SECRET=[your-google-client-secret]
DATABASE_URL=postgresql://anonymous-messages_owner:pmK9yrPWa5wt@ep-still-shadow-a19fqc9l.ap-southeast-1.aws.neon.tech/anonymous-messages?sslmode=require
```

3. Run the application:
```bash
flask run
```

## Deployment (Cloudflare Pages)

1. Push your code to GitHub

2. In Cloudflare Pages:
   - Connect your repository
   - Set build command: `pip install -r requirements.txt`
   - Set build output directory: `build`
   - Add environment variables:
     ```
     SECRET_KEY=[your-secret-key]
     GOOGLE_OAUTH_CLIENT_ID=[your-google-client-id]
     GOOGLE_OAUTH_CLIENT_SECRET=[your-google-client-secret]
     DATABASE_URL=[your-database-url]
     ```

3. Deploy!
