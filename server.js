require('dotenv').config();
const express = require('express');
const session = require('express-session');
const flash = require('connect-flash');
const bcrypt = require('bcryptjs');
const { nanoid } = require('nanoid');
const fs = require('fs').promises;
const path = require('path');
const expressLayouts = require('express-ejs-layouts');
const MemoryStore = require('memorystore')(session);

const app = express();
const port = process.env.PORT || 8080;

// Middleware
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(expressLayouts);
app.set('layout', 'layout');
app.set("layout extractScripts", true);
app.set("layout extractStyles", true);

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Session configuration
app.use(session({
    secret: process.env.SECRET_KEY || 'dev',
    resave: false,
    saveUninitialized: false,
    cookie: { 
        secure: false, // Set to true only if using HTTPS
        maxAge: 1000 * 60 * 60 * 24 * 7 // 1 week
    },
    store: new MemoryStore({
        checkPeriod: 86400000 // prune expired entries every 24h
    })
}));

// Flash messages
app.use(flash());

// Make user and messages available to all views
app.use((req, res, next) => {
    res.locals.user = req.session.user || null;
    res.locals.messages = {
        error: req.flash('error'),
        success: req.flash('success')
    };
    next();
});

// Add this after other middleware and before routes
app.use((req, res, next) => {
    // Set default template variables
    res.locals = {
        user: req.session.user || null,
        messages: {
            error: req.flash('error') || [],
            success: req.flash('success') || []
        },
        title: '匿名留言'
    };
    next();
});

// Data storage
const INSTANCE_PATH = path.join(__dirname, 'instance');
const USERS_FILE = path.join(INSTANCE_PATH, 'Users.json');
const MESSAGES_FILE = path.join(INSTANCE_PATH, 'Messages.json');

// Ensure instance directory exists
async function initializeStorage() {
    try {
        await fs.mkdir(INSTANCE_PATH, { recursive: true });
        for (const file of [USERS_FILE, MESSAGES_FILE]) {
            try {
                await fs.access(file);
            } catch {
                await fs.writeFile(file, '[]');
            }
        }
    } catch (err) {
        console.error('Error initializing storage:', err);
    }
}

// Data helpers
async function loadData(file) {
    try {
        const data = await fs.readFile(file, 'utf8');
        return JSON.parse(data);
    } catch {
        return [];
    }
}

async function saveData(file, data) {
    await fs.writeFile(file, JSON.stringify(data, null, 2));
}

// Authentication middleware
function isAuthenticated(req, res, next) {
    if (req.session.user) {
        return next();
    }
    res.redirect('/login');
}

// Routes
app.get('/', (req, res) => {
    res.render('index');
});

app.get('/register', (req, res) => {
    res.render('register');
});

app.post('/register', async (req, res) => {
    try {
        const { username, password } = req.body;
        const users = await loadData(USERS_FILE);
        
        if (users.some(u => u.username === username)) {
            req.flash('error', '使用者名稱已存在');
            return res.redirect('/register');
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const link = nanoid(10);
        
        const newUser = {
            id: users.length + 1,
            username,
            password_hash: hashedPassword,
            link: link
        };
        
        users.push(newUser);
        await saveData(USERS_FILE, users);
        
        req.flash('success', '註冊成功');
        res.redirect('/login');
    } catch (err) {
        console.error(err);
        req.flash('error', 'Registration failed');
        res.redirect('/register');
    }
});

app.get('/login', (req, res) => {
    res.render('login');
});

app.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        
        if (!username || !password) {
            req.flash('error', '請輸入使用者名稱和密碼');
            return res.redirect('/login');
        }

        const users = await loadData(USERS_FILE);
        const user = users.find(u => u.username === username);
        
        if (!user) {
            req.flash('error', '使用者名稱或密碼錯誤');
            return res.redirect('/login');
        }

        const isValidPassword = await bcrypt.compare(password, user.password_hash);
        
        if (!isValidPassword) {
            req.flash('error', '使用者名稱或密碼錯誤');
            return res.redirect('/login');
        }

        req.session.user = {
            id: user.id,
            username: user.username,
            link: user.link
        };
        
        req.session.save((err) => {
            if (err) {
                console.error('Session save error:', err);
                req.flash('error', '登入失敗，請稍後再試');
                return res.redirect('/login');
            }
            res.redirect('/message_box');
        });
    } catch (err) {
        console.error('Login error:', err);
        req.flash('error', '登入失敗，請稍後再試');
        res.redirect('/login');
    }
});

app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/');
});

app.get('/message_box', isAuthenticated, async (req, res) => {
    try {
        const messages = await loadData(MESSAGES_FILE);
        const userMessages = messages.filter(m => m.recipient_id === req.session.user.id)
            .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)); // Sort by newest first
        
        res.render('message_box', { 
            messages: userMessages,
            baseUrl: `${req.protocol}://${req.get('host')}`
        });
    } catch (err) {
        console.error('Error loading messages:', err);
        req.flash('error', '載入訊息失敗');
        res.redirect('/');
    }
});

app.get('/l/:link', async (req, res) => {
    const users = await loadData(USERS_FILE);
    const user = users.find(u => u.link === req.params.link);
    
    if (!user) {
        req.flash('error', '無效的連結');
        return res.redirect('/');
    }
    
    res.render('anonymous_message', { 
        username: user.username
    });
});

// Add POST route for sending anonymous messages
app.post('/l/:link', async (req, res) => {
    try {
        const { content } = req.body;
        if (!content || content.trim() === '') {
            req.flash('error', '請輸入訊息內容');
            return res.redirect(`/l/${req.params.link}`);
        }

        const users = await loadData(USERS_FILE);
        const recipient = users.find(u => u.link === req.params.link);
        
        if (!recipient) {
            req.flash('error', '無效的連結');
            return res.redirect('/');
        }

        const messages = await loadData(MESSAGES_FILE);
        const newMessage = {
            id: Date.now(), // Use timestamp as ID
            content: content.trim(),
            timestamp: new Date().toISOString(),
            recipient_id: recipient.id,
            is_anonymous: true,
            created_at: new Date().toISOString()
        };

        messages.push(newMessage);
        await saveData(MESSAGES_FILE, messages);

        req.flash('success', '訊息已送出');
        res.redirect(`/l/${req.params.link}`);
    } catch (err) {
        console.error('Error sending message:', err);
        req.flash('error', '發送訊息失敗');
        res.redirect(`/l/${req.params.link}`);
    }
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(500).render('error', {
        message: '發生錯誤，請稍後再試',
        error: process.env.NODE_ENV === 'development' ? err : {}
    });
});

// 404 handler (must be after all routes)
app.use((req, res) => {
    res.status(404).render('error', {
        message: '找不到頁面',
        error: {}
    });
});

// Initialize and start server
initializeStorage().then(() => {
    app.listen(port, () => {
        console.log(`Server running on port ${port}`);
    });
}).catch(err => {
    console.error('Failed to initialize storage:', err);
    process.exit(1);
}); 