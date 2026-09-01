require('dotenv').config();
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');

// Configure Cloudinary using your environment variables
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Configure Multer to stream uploaded video files directly to Cloudinary
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'nb-hub-videos',
    resource_type: 'video', // Directs Cloudinary to treat incoming streams as videos
    allowed_formats: ['mp4', 'mov', 'avi', 'mkv', 'webm']
  }
});

module.exports = { cloudinary, storage };