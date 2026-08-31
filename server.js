const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Database = require('better-sqlite3');

const app = express();
const JWT_SECRET = 'nbhub_secret_key_12345';

// 1. DATABASE SETUP & MIGRATIONS
const db = new Database('nbhub.db');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    password TEXT,
    role TEXT DEFAULT 'user',
    is_banned INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS videos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT,
    category TEXT DEFAULT 'General',
    filename TEXT,
    thumbnail TEXT,
    url TEXT,
    views INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    video_id INTEGER,
    username TEXT,
    comment TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// Auto-Migrations for existing databases
try { db.exec(`ALTER TABLE users ADD COLUMN is_banned INTEGER DEFAULT 0;`); } catch (e) {}
try { db.exec(`ALTER TABLE videos ADD COLUMN views INTEGER DEFAULT 0;`); } catch (e) {}
try { db.exec(`ALTER TABLE videos ADD COLUMN category TEXT DEFAULT 'General';`); } catch (e) {}
try { db.exec(`ALTER TABLE videos ADD COLUMN thumbnail TEXT;`); } catch (e) {}

// Default Admin account
const adminCheck = db.prepare('SELECT * FROM users WHERE username = ?').get('admin');
if (!adminCheck) {
  const hashedPassword = bcrypt.hashSync('adminpassword', 10);
  db.prepare('INSERT INTO users (username, password, role) VALUES (?, ?, ?)').run('admin', hashedPassword, 'admin');
}

app.use(express.json());
app.use(express.static('public'));

// Protected File Delivery Middleware
app.use('/uploads', (req, res, next) => {
  const token = req.query.token;
  if (!token) return res.status(401).send('Unauthorized access');
  try {
    const user = jwt.verify(token, JWT_SECRET);
    const dbUser = db.prepare('SELECT * FROM users WHERE id = ?').get(user.id);
    if (dbUser && dbUser.is_banned === 1) return res.status(403).send('Account is banned.');
    next();
  } catch (err) {
    res.status(403).send('Invalid or expired session');
  }
}, express.static(path.join(__dirname, 'uploads')));

if (!fs.existsSync('./uploads')) {
  fs.mkdirSync('./uploads');
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});
const upload = multer({ storage });

// AUTH MIDDLEWARES
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'Please log in first.' });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ message: 'Session expired.' });
    
    const dbUser = db.prepare('SELECT * FROM users WHERE id = ?').get(user.id);
    if (!dbUser || dbUser.is_banned === 1) {
      return res.status(403).json({ message: 'Your account has been banned.' });
    }
    
    req.user = dbUser;
    next();
  });
}

function requireAdmin(req, res, next) {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Access denied: Admins only.' });
  }
  next();
}

// --- AUTH ROUTES ---
app.post('/api/register', (req, res) => {
  const { username, password } = req.body;
  const hashedPassword = bcrypt.hashSync(password, 10);
  try {
    db.prepare('INSERT INTO users (username, password) VALUES (?, ?)').run(username, hashedPassword);
    res.json({ message: 'User registered successfully!' });
  } catch (err) {
    res.status(400).json({ message: 'Username already taken.' });
  }
});

app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);

  if (!user || !bcrypt.compareSync(password, user.password)) {
    return res.status(400).json({ message: 'Invalid username or password' });
  }

  if (user.is_banned === 1) {
    return res.status(403).json({ message: 'This account has been banned by an admin.' });
  }

  const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET);
  res.json({ message: 'Login successful!', token, role: user.role, username: user.username });
});

// --- VIDEO ROUTES ---
app.get('/api/videos', authenticateToken, (req, res) => {
  const videos = db.prepare('SELECT * FROM videos ORDER BY id DESC').all();
  res.json(videos);
});

app.post('/api/upload', authenticateToken, requireAdmin, upload.fields([{ name: 'video', maxCount: 1 }, { name: 'thumbnail', maxCount: 1 }]), (req, res) => {
  const title = req.body.title;
  const category = req.body.category || 'General';
  const videoFile = req.files['video'][0].filename;
  const thumbnailFile = req.files['thumbnail'] ? req.files['thumbnail'][0].filename : null;

  const url = `/uploads/${videoFile}`;
  const thumbnailUrl = thumbnailFile ? `/uploads/${thumbnailFile}` : null;

  db.prepare('INSERT INTO videos (title, category, filename, thumbnail, url) VALUES (?, ?, ?, ?, ?)').run(title, category, videoFile, thumbnailUrl, url);
  res.json({ message: 'Video published successfully!' });
});

app.post('/api/videos/:id/view', authenticateToken, (req, res) => {
  db.prepare('UPDATE videos SET views = views + 1 WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

app.put('/api/videos/:id', authenticateToken, requireAdmin, (req, res) => {
  const { title, category } = req.body;
  db.prepare('UPDATE videos SET title = ?, category = ? WHERE id = ?').run(title, category, req.params.id);
  res.json({ message: 'Video updated successfully!' });
});

app.delete('/api/videos/:id', authenticateToken, requireAdmin, (req, res) => {
  const video = db.prepare('SELECT * FROM videos WHERE id = ?').get(req.params.id);
  if (video) {
    try { fs.unlinkSync(path.join(__dirname, 'uploads', video.filename)); } catch (e) {}
    if (video.thumbnail) {
      try { fs.unlinkSync(path.join(__dirname, 'uploads', path.basename(video.thumbnail))); } catch (e) {}
    }
    db.prepare('DELETE FROM videos WHERE id = ?').run(req.params.id);
    db.prepare('DELETE FROM comments WHERE video_id = ?').run(req.params.id);
  }
  res.json({ message: 'Video deleted successfully!' });
});

// --- COMMENTS ROUTES ---
app.get('/api/videos/:id/comments', authenticateToken, (req, res) => {
  const comments = db.prepare('SELECT * FROM comments WHERE video_id = ? ORDER BY id DESC').all(req.params.id);
  res.json(comments);
});

app.post('/api/videos/:id/comments', authenticateToken, (req, res) => {
  const { comment } = req.body;
  db.prepare('INSERT INTO comments (video_id, username, comment) VALUES (?, ?, ?)').run(req.params.id, req.user.username, comment);
  res.json({ message: 'Comment posted successfully!' });
});

// --- USER MANAGEMENT ROUTES (ADMIN ONLY) ---
app.get('/api/users', authenticateToken, requireAdmin, (req, res) => {
  const users = db.prepare('SELECT id, username, role, is_banned FROM users').all();
  res.json(users);
});

app.put('/api/users/:id/ban', authenticateToken, requireAdmin, (req, res) => {
  const { is_banned } = req.body;
  db.prepare('UPDATE users SET is_banned = ? WHERE id = ?').run(is_banned ? 1 : 0, req.params.id);
  res.json({ message: 'User status updated!' });
});

app.put('/api/users/:id/role', authenticateToken, requireAdmin, (req, res) => {
  const { role } = req.body;
  db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, req.params.id);
  res.json({ message: 'User role updated!' });
});

app.listen(3000, () => {
  console.log('NB Hub (All Features Active) live on http://localhost:3000');
});