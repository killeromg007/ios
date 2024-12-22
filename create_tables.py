from app import db

def init_db():
    with db.engine.connect() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                username VARCHAR(80) UNIQUE NOT NULL,
                password_hash VARCHAR(120),
                email VARCHAR(120) UNIQUE,
                google_id VARCHAR(100) UNIQUE
            );

            CREATE TABLE IF NOT EXISTS message_boxes (
                id SERIAL PRIMARY KEY,
                link_id VARCHAR(16) UNIQUE NOT NULL,
                created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                user_id INTEGER NOT NULL REFERENCES users(id)
            );

            CREATE TABLE IF NOT EXISTS messages (
                id SERIAL PRIMARY KEY,
                content TEXT NOT NULL,
                timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                box_id INTEGER NOT NULL REFERENCES message_boxes(id)
            );
        """)
        conn.commit()

if __name__ == '__main__':
    init_db()
    print("Database tables created successfully!")
