require('dotenv').config();
const express = require('express');
const session = require('express-session');
const flash = require('connect-flash');
const bcrypt = require('bcryptjs');
const { nanoid } = require('nanoid');
const fs = require('fs').promises;
const path = require('path');
const expressLayouts = require('express-ejs-layouts');

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
app.use(session({
    secret: process.env.SECRET_KEY || 'dev',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: process.env.NODE_ENV === 'production' }
}));
app.use(flash());

// Add this middleware to make flash messages and user available to all views
app.use((req, res, next) => {
    res.locals.user = req.session.user;
    res.locals.messages = req.flash();
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
    res.render('index', { user: req.session.user });
});

app.get('/register', (req, res) => {
    res.render('register', { messages: req.flash() });
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
    res.render('login', { messages: req.flash() });
});

app.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const users = await loadData(USERS_FILE);
        const user = users.find(u => u.username === username);
        
        if (user && await bcrypt.compare(password, user.password_hash)) {
            req.session.user = user;
            res.redirect('/message_box');
        } else {
            req.flash('error', '使用者名稱或密碼錯誤');
            res.redirect('/login');
        }
    } catch (err) {
        console.error(err);
        req.flash('error', '登入失敗');
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
        const userMessages = messages.filter(m => m.recipient_id === req.session.user.id);
        res.render('message_box', { 
            user: req.session.user,
            messages: userMessages,
            baseUrl: `${req.protocol}://${req.get('host')}`
        });
    } catch (err) {
        console.error(err);
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
    
    res.render('anonymous_message', { username: user.username });
});

// Initialize and start server
initializeStorage().then(() => {
app.listen(port, () => {
        console.log(`Server running on port ${port}`);
    });
}); 