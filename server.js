require('dotenv').config();
const express = require('express');
const path = require('path');
const multer = require('multer');

// Import Cloudinary storage configuration
const { storage } = require('./cloudinary');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware for JSON and form data parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static frontend assets (HTML, CSS, JS from 'public' folder)
app.use(express.static(path.join(__dirname, 'public')));

// Configure Multer to stream uploads straight to Cloudinary
const upload = multer({ storage: storage });

// ----------------------------------------------------
// AUTHENTICATION ROUTES (Returns JSON to prevent syntax errors)
// ----------------------------------------------------

// POST /login
app.post('/login', (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ success: false, message: 'Please enter both username and password.' });
    }

    // Temporary basic verification (Replace with your database query logic if using DB)
    console.log(`Login attempt for user: ${username}`);
    
    // Respond with valid JSON
    res.json({ 
      success: true, 
      message: 'Login successful!',
      user: { username } 
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /register
app.post('/register', (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ success: false, message: 'Please provide all registration fields.' });
    }

    // Temporary registration logic
    console.log(`Registered new user: ${username}`);

    res.json({ 
      success: true, 
      message: 'Registration successful! You can now log in.' 
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ----------------------------------------------------
// VIDEO UPLOAD ROUTE (Cloudinary Integration)
// ----------------------------------------------------

// POST /upload
app.post('/upload', upload.single('video'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No video file provided.' });
    }

    // req.file.path contains the permanent Cloudinary HTTPS URL
    const videoUrl = req.file.path; 
    const videoTitle = req.body.title || 'Untitled Video';

    console.log(`Video uploaded successfully to Cloudinary: ${videoUrl}`);

    res.json({
      success: true,
      message: 'Video uploaded to Cloudinary!',
      title: videoTitle,
      url: videoUrl
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Catch-all route to serve main page if unknown route is hit
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start Express Server
app.listen(PORT, () => {
  console.log(`NB Hub server running on port ${PORT}`);
});