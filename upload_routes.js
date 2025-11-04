const express = require("express");
const router = express.Router();
const cloudinary = require("cloudinary").v2;
const multer = require("multer");

// Cloudinary config (use .env)
cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.API_KEY,
  api_secret: process.env.API_SECRET,
});

// Multer in-memory storage
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Upload image
router.post("/", upload.single("image"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: "No image file provided." });
  }

  try {
    // Upload to Cloudinary folder 'pos_products'
    const uploadResult = await new Promise((resolve, reject) => {
      cloudinary.uploader
        .upload_stream({ folder: "pos_products" }, (error, result) => {
          if (error) {
            reject(error);
          } else {
            resolve(result);
          }
        })
        .end(req.file.buffer);
    });

    // Send back the secure URL
    res.status(200).json({
      message: "Image uploaded successfully",
      image_url: uploadResult.secure_url,
    });
  } catch (error) {
    console.error("Error uploading to Cloudinary:", error);
    res
      .status(500)
      .json({ message: "Image upload failed.", error: error.message });
  }
});

module.exports = router;
