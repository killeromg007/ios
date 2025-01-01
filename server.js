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

// Admin middleware
function isAdmin(req, res, next) {
    if (req.session.user && req.session.user.isAdmin) {
        return next();
    }
    res.status(403).render('error', {
        message: '沒有管理員權限',
        error: {}
    });
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
        if (!Array.isArray(messages)) {
            throw new Error('Invalid messages data');
        }
        
        const userMessages = messages
            .filter(m => m.recipient_id === req.session.user.id)
            .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        
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
    try {
        const users = await loadData(USERS_FILE);
        const user = users.find(u => u.link === req.params.link);
        
        if (!user) {
            req.flash('error', '無效的連結');
            return res.redirect('/');
        }
        
        res.render('anonymous_message', { 
            recipientName: user.username,
            title: `傳送訊息給 ${user.username}`
        });
    } catch (err) {
        console.error('Error loading user:', err);
        req.flash('error', '載入使用者資料失敗');
        res.redirect('/');
    }
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

// Admin routes
app.get('/admin/login', (req, res) => {
    res.render('admin_login');
});

app.post('/admin/login', async (req, res) => {
    const { username, password } = req.body;
    if (username === process.env.ADMIN_USERNAME && 
        password === process.env.ADMIN_PASSWORD) {
        req.session.user = {
            username: process.env.ADMIN_USERNAME,
            isAdmin: true
        };
        res.redirect('/admin/dashboard');
    } else {
        req.flash('error', '管理員帳號或密碼錯誤');
        res.redirect('/admin/login');
    }
});

app.get('/admin/dashboard', isAdmin, async (req, res) => {
    try {
        const users = await loadData(USERS_FILE);
        const messages = await loadData(MESSAGES_FILE);
        
        res.render('admin_dashboard', {
            users,
            messages,
            getUserName: (id) => {
                const user = users.find(u => u.id === id);
                return user ? user.username : '已刪除的使用者';
            }
        });
    } catch (err) {
        console.error('Admin dashboard error:', err);
        req.flash('error', '載入資料失敗');
        res.redirect('/admin/login');
    }
});

// Admin API endpoints
app.delete('/api/admin/users/:id', isAdmin, async (req, res) => {
    try {
        const userId = parseInt(req.params.id);
        let users = await loadData(USERS_FILE);
        let messages = await loadData(MESSAGES_FILE);
        
        users = users.filter(u => u.id !== userId);
        messages = messages.filter(m => m.recipient_id !== userId);
        
        await saveData(USERS_FILE, users);
        await saveData(MESSAGES_FILE, messages);
        
        res.json({ success: true });
    } catch (err) {
        console.error('Delete user error:', err);
        res.status(500).json({ success: false });
    }
});

app.delete('/api/admin/messages/:id', isAdmin, async (req, res) => {
    try {
        const messageId = parseInt(req.params.id);
        let messages = await loadData(MESSAGES_FILE);
        messages = messages.filter(m => m.id !== messageId);
        await saveData(MESSAGES_FILE, messages);
        res.json({ success: true });
    } catch (err) {
        console.error('Delete message error:', err);
        res.status(500).json({ success: false });
    }
});

// Admin JSON editor endpoints
app.get('/api/admin/json/:type', isAdmin, async (req, res) => {
    try {
        const type = req.params.type;
        let data;
        
        switch (type) {
            case 'users':
                data = await loadData(USERS_FILE);
                break;
            case 'messages':
                data = await loadData(MESSAGES_FILE);
                break;
            default:
                return res.status(400).json({ error: '無效的檔案類型' });
        }
        
        res.json(data);
    } catch (err) {
        console.error('Load JSON error:', err);
        res.status(500).json({ error: '載入失敗' });
    }
});

app.post('/api/admin/json/:type', isAdmin, async (req, res) => {
    try {
        const type = req.params.type;
        const { content } = req.body;
        
        // Validate JSON
        let data;
        try {
            data = JSON.parse(content);
            if (!Array.isArray(data)) {
                throw new Error('Data must be an array');
            }
        } catch (e) {
            return res.status(400).json({ error: '無效的 JSON 格式' });
        }
        
        // Save to appropriate file
        switch (type) {
            case 'users':
                await saveData(USERS_FILE, data);
                break;
            case 'messages':
                await saveData(MESSAGES_FILE, data);
                break;
            default:
                return res.status(400).json({ error: '無效的檔案類型' });
        }
        
        res.json({ success: true });
    } catch (err) {
        console.error('Save JSON error:', err);
        res.status(500).json({ error: '儲存失敗' });
    }
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Error:', err);
    if (req.xhr || req.headers.accept.includes('json')) {
        // Handle AJAX/API errors
        res.status(500).json({ 
            error: '發生錯誤，請稍後再試'
        });
    } else {
        // Handle regular page errors
        res.status(500).render('error', {
            message: '發生錯誤，請稍後再試',
            error: {}
        });
    }
});

// 404 handler (must be after all routes)
app.use((req, res) => {
    if (req.xhr || req.headers.accept.includes('json')) {
        res.status(404).json({ 
            error: '找不到頁面'
        });
    } else {
        res.status(404).render('error', {
            message: '找不到頁面',
            error: {}
        });
    }
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