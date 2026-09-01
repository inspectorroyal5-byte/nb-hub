require('dotenv').config();
const express = require('express');
const path = require('path');
const multer = require('multer');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);

// Import Cloudinary storage configuration
const { storage } = require('./cloudinary');

const app = express();
const PORT = process.env.PORT || 3000;

// Configure PostgreSQL Connection Pool for Supabase
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Setup Express Sessions stored inside Supabase
app.use(session({
  store: new pgSession({
    pool: pool,
    tableName: 'session',
    createTableIfMissing: true
  }),
  secret: process.env.SESSION_SECRET || 'nbhub_secret_key_123',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 30 * 24 * 60 * 60 * 1000 } // 30 days
}));

// Serve static assets from public folder
app.use(express.static(path.join(__dirname, 'public')));

// Configure Multer for Cloudinary uploads
const upload = multer({ storage: storage });

// ----------------------------------------------------
// AUTHENTICATION ROUTES (SUPABASE PERSISTENCE)
// ----------------------------------------------------

const handleRegister = async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ success: false, message: 'Username and password are required.' });
  }

  try {
    const userCheck = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
    if (userCheck.rows.length > 0) {
      return res.status(400).json({ success: false, message: 'Username already exists.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = await pool.query(
      'INSERT INTO users (username, password) VALUES ($1, $2) RETURNING id, username',
      [username, hashedPassword]
    );

    req.session.userId = newUser.rows[0].id;
    return res.json({ success: true, message: 'Registration successful!', user: newUser.rows[0] });
  } catch (error) {
    console.error('Register Error:', error);
    return res.status(500).json({ success: false, message: 'Database error during registration.' });
  }
};

const handleLogin = async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ success: false, message: 'Username and password are required.' });
  }

  try {
    const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
    if (result.rows.length === 0) {
      return res.status(400).json({ success: false, message: 'Invalid username or password.' });
    }

    const user = result.rows[0];
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: 'Invalid username or password.' });
    }

    req.session.userId = user.id;
    return res.json({ success: true, message: 'Login successful!', user: { id: user.id, username: user.username } });
  } catch (error) {
    console.error('Login Error:', error);
    return res.status(500).json({ success: false, message: 'Database error during login.' });
  }
};

app.post('/api/register', handleRegister);
app.post('/register', handleRegister);
app.post('/api/login', handleLogin);
app.post('/login', handleLogin);

// ----------------------------------------------------
// VIDEO ROUTES (PERSISTED IN SUPABASE)
// ----------------------------------------------------

const handleGetVideos = async (req, res) => {
  try {
    const result = await pool.query('SELECT videos.id, videos.title, videos.url, users.username FROM videos LEFT JOIN users ON videos.user_id = users.id ORDER BY videos.created_at DESC');
    return res.json({ success: true, videos: result.rows });
  } catch (error) {
    console.error('Get Videos Error:', error);
    return res.status(500).json({ success: false, message: 'Failed to retrieve videos.' });
  }
};

app.get('/api/videos', handleGetVideos);
app.get('/videos', handleGetVideos);

app.post('/upload', upload.single('video'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No video file provided.' });
    }

    const videoUrl = req.file.path;
    const videoTitle = req.body.title || 'Untitled Video';
    const userId = req.session.userId || null;

    const result = await pool.query(
      'INSERT INTO videos (title, url, user_id) VALUES ($1, $2, $3) RETURNING *',
      [videoTitle, videoUrl, userId]
    );

    res.json({
      success: true,
      message: 'Video uploaded and saved to Supabase!',
      video: result.rows[0]
    });
  } catch (error) {
    console.error('Upload Error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Catch-all route
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start Server
app.listen(PORT, () => {
  console.log(`NB Hub server running on port ${PORT}`);
});