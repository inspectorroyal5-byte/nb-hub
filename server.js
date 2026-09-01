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

// Configure Multer to stream uploads directly to Cloudinary
const upload = multer({ storage: storage });

// ----------------------------------------------------
// IN-MEMORY DATA STORAGE (Temporary until DB connection)
// ----------------------------------------------------
const uploadedVideos = [];

// ----------------------------------------------------
// AUTHENTICATION HANDLERS
// ----------------------------------------------------

const handleLogin = (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ success: false, message: 'Please enter both username and password.' });
    }

    console.log(`Login attempt for user: ${username}`);
    
    // Always respond with JSON
    return res.json({ 
      success: true, 
      message: 'Login successful!',
      user: { username } 
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

const handleRegister = (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ success: false, message: 'Please fill in all registration fields.' });
    }

    console.log(`Registered new user: ${username}`);

    return res.json({ 
      success: true, 
      message: 'Registration successful! You can now log in.' 
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Map routes for both /api/* and root paths
app.post('/api/login', handleLogin);
app.post('/login', handleLogin);

app.post('/api/register', handleRegister);
app.post('/register', handleRegister);

// ----------------------------------------------------
// VIDEO FEED & FETCH HANDLERS
// ----------------------------------------------------

const handleGetVideos = (req, res) => {
  try {
    // Returns array of uploaded videos to satisfy frontend fetch demands
    return res.json({ 
      success: true, 
      videos: uploadedVideos 
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

app.get('/api/videos', handleGetVideos);
app.get('/videos', handleGetVideos);

// ----------------------------------------------------
// VIDEO UPLOAD ROUTE (Cloudinary Integration)
// ----------------------------------------------------

app.post('/upload', upload.single('video'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No video file provided.' });
    }

    // req.file.path contains the permanent Cloudinary HTTPS URL
    const videoUrl = req.file.path; 
    const videoTitle = req.body.title || 'Untitled Video';

    const newVideo = {
      id: Date.now(),
      title: videoTitle,
      url: videoUrl
    };

    uploadedVideos.unshift(newVideo);

    console.log(`Video uploaded successfully to Cloudinary: ${videoUrl}`);

    res.json({
      success: true,
      message: 'Video uploaded to Cloudinary!',
      video: newVideo
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Catch-all route to serve main frontend index page
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start Express Server
app.listen(PORT, () => {
  console.log(`NB Hub server running on port ${PORT}`);
});