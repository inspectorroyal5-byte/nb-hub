require('dotenv').config();
const express = require('express');
const path = require('path');
const multer = require('multer');

// Import the Cloudinary storage engine configured in cloudinary.js
const { storage } = require('./cloudinary');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware for JSON and form data parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static frontend assets (e.g., HTML, CSS, JS from 'public' folder)
app.use(express.static(path.join(__dirname, 'public')));

// Configure Multer to use Cloudinary cloud storage instead of local disk storage
const upload = multer({ storage: storage });

// Video Upload API Endpoint
app.post('/upload', upload.single('video'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No video file provided.' });
    }

    // req.file.path contains the permanent HTTPS Cloudinary delivery URL
    const videoUrl = req.file.path; 
    const videoTitle = req.body.title || 'Untitled Video';

    // SUCCESS LOGIC:
    // If using SQLite/Database, insert the persistent Cloudinary URL string into your database here:
    // db.prepare("INSERT INTO videos (title, url) VALUES (?, ?)").run(videoTitle, videoUrl);

    console.log(`Uploaded "${videoTitle}" to Cloudinary: ${videoUrl}`);

    res.json({
      success: true,
      message: 'Video uploaded successfully to Cloudinary!',
      title: videoTitle,
      url: videoUrl
    });
  } catch (error) {
    console.error('Upload Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Start express server
app.listen(PORT, () => {
  console.log(`NB Hub server running on port ${PORT}`);
});