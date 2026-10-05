require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const db = require('./data/db');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'solana_beauty_fallback_secret_key_2026';

// -------------------------------------------------------------
// 1. SECURITY MIDDLEWARES & HEADERS
// -------------------------------------------------------------
// Configure Helmet with relaxed CSP for safe external resources (Google Fonts, Unsplash images)
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "blob:", "https://images.unsplash.com", "https://*.unsplash.com"],
      connectSrc: ["'self'"],
      frameSrc: ["'self'"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: [],
    },
  },
  crossOriginEmbedderPolicy: false
}));

app.use(cors());
app.use(cookieParser());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Anti-bruteforce rate limiter for login
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 login requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Please try again after 15 minutes.' }
});

// General API rate limiter
const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 120, // 120 requests per minute
  standardHeaders: true,
  legacyHeaders: false
});
app.use('/api/', apiLimiter);

// -------------------------------------------------------------
// 2. STATIC FILES & SAFE UPLOADS STORAGE
// -------------------------------------------------------------
const uploadDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Generate safe, sanitized random filename to prevent path traversal or collision
    const ext = path.extname(file.originalname).toLowerCase();
    const safeName = 'work_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9) + ext;
    cb(null, safeName);
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max photo size
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|webp|gif|heic|avif/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype.toLowerCase()) || file.mimetype.startsWith('image/');
    if (extname && mimetype) {
      return cb(null, true);
    }
    cb(new Error('Only image files (JPG, PNG, WebP, AVIF, GIF) are allowed.'));
  }
});

app.use(express.static(path.join(__dirname, 'public')));

// -------------------------------------------------------------
// 3. AUTHENTICATION HELPERS & MIDDLEWARES
// -------------------------------------------------------------
function authenticateAdmin(req, res, next) {
  const token = req.cookies.solana_admin_token || (req.headers.authorization && req.headers.authorization.split(' ')[1]);
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized. Please sign in.' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.admin = decoded;
    next();
  } catch (err) {
    res.clearCookie('solana_admin_token');
    return res.status(401).json({ error: 'Session expired or invalid. Please sign in again.' });
  }
}

// -------------------------------------------------------------
// 4. PUBLIC API ROUTES
// -------------------------------------------------------------

// Get all site settings
app.get('/api/settings', (req, res) => {
  try {
    const rows = db.prepare('SELECT key, value FROM site_settings').all();
    const settings = {};
    rows.forEach(r => { settings[r.key] = r.value; });
    res.json(settings);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

// Get catalog categories with their services and gallery images
app.get('/api/catalog', (req, res) => {
  try {
    const categories = db.prepare('SELECT * FROM categories ORDER BY sort_order ASC, id ASC').all();
    const services = db.prepare('SELECT * FROM services ORDER BY sort_order ASC, id ASC').all();
    const gallery = db.prepare('SELECT * FROM gallery_items ORDER BY sort_order ASC, id ASC').all();

    const data = categories.map(cat => ({
      ...cat,
      services: services.filter(s => s.category_id === cat.id),
      gallery: gallery.filter(g => g.category_id === cat.id)
    }));

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch catalog' });
  }
});

// Public booking request submission
app.post('/api/book', (req, res) => {
  try {
    const { client_name, client_phone, service_name, preferred_date, comment } = req.body;
    if (!client_name || !client_phone) {
      return res.status(400).json({ error: 'Name and Phone number are required.' });
    }

    const stmt = db.prepare(`
      INSERT INTO booking_requests (client_name, client_phone, service_name, preferred_date, comment)
      VALUES (?, ?, ?, ?, ?)
    `);
    const info = stmt.run(
      client_name.trim().slice(0, 100),
      client_phone.trim().slice(0, 40),
      (service_name || '').slice(0, 150),
      (preferred_date || '').slice(0, 50),
      (comment || '').slice(0, 500)
    );

    res.json({ success: true, booking_id: info.lastInsertRowid, message: 'Thank you! Your appointment request has been received.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to submit appointment request.' });
  }
});

// -------------------------------------------------------------
// 5. AUTHENTICATION ROUTES
// -------------------------------------------------------------

app.post('/api/auth/login', loginLimiter, (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required.' });
    }

    const admin = db.prepare('SELECT * FROM admin_users WHERE username = ?').get(username);
    if (!admin) {
      return res.status(401).json({ error: 'Invalid username or password.' });
    }

    const isValid = bcrypt.compareSync(password, admin.password_hash);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid username or password.' });
    }

    const token = jwt.sign(
      { id: admin.id, username: admin.username },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.cookie('solana_admin_token', token, {
      httpOnly: true,
      secure: false, // works seamlessly on localhost and http, will be overridden by reverse proxy if https
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    res.json({ success: true, username: admin.username, token });
  } catch (err) {
    res.status(500).json({ error: 'Login error occurred.' });
  }
});

app.get('/api/auth/verify', (req, res) => {
  const token = req.cookies.solana_admin_token || (req.headers.authorization && req.headers.authorization.split(' ')[1]);
  if (!token) return res.status(401).json({ authenticated: false });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    res.json({ authenticated: true, username: decoded.username });
  } catch (err) {
    res.status(401).json({ authenticated: false });
  }
});

app.post('/api/auth/logout', (req, res) => {
  res.clearCookie('solana_admin_token');
  res.json({ success: true, message: 'Logged out successfully.' });
});

// -------------------------------------------------------------
// 6. PROTECTED ADMIN ROUTES (MANAGEMENT)
// -------------------------------------------------------------

// Update Site Settings
app.post('/api/admin/settings', authenticateAdmin, (req, res) => {
  try {
    const settings = req.body;
    const upsert = db.prepare('INSERT OR REPLACE INTO site_settings (key, value) VALUES (?, ?)');
    const tx = db.transaction((entries) => {
      for (const [key, val] of entries) {
        upsert.run(key, String(val));
      }
    });
    tx(Object.entries(settings));
    res.json({ success: true, message: 'Settings updated successfully.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update settings.' });
  }
});

// CATEGORIES CRUD
app.post('/api/admin/categories', authenticateAdmin, (req, res) => {
  try {
    const { title, description } = req.body;
    if (!title) return res.status(400).json({ error: 'Category title is required.' });

    const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') + '-' + Date.now().toString(36);
    const maxOrder = db.prepare('SELECT MAX(sort_order) as max_ord FROM categories').get().max_ord || 0;
    
    const stmt = db.prepare('INSERT INTO categories (slug, title, description, sort_order) VALUES (?, ?, ?, ?)');
    const info = stmt.run(slug, title.trim(), (description || '').trim(), maxOrder + 1);

    res.json({ success: true, id: info.lastInsertRowid, title, slug });
  } catch (err) {
    res.status(500).json({ error: 'Failed to add category.' });
  }
});

app.put('/api/admin/categories/:id', authenticateAdmin, (req, res) => {
  try {
    const { title, description } = req.body;
    const { id } = req.params;
    db.prepare('UPDATE categories SET title = ?, description = ? WHERE id = ?')
      .run(title.trim(), (description || '').trim(), id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update category.' });
  }
});

app.delete('/api/admin/categories/:id', authenticateAdmin, (req, res) => {
  try {
    const { id } = req.params;
    db.prepare('DELETE FROM categories WHERE id = ?').run(id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete category.' });
  }
});

// SERVICES CRUD
app.post('/api/admin/services', authenticateAdmin, (req, res) => {
  try {
    const { category_id, title, description, price, duration } = req.body;
    if (!category_id || !title) return res.status(400).json({ error: 'Category and Title are required.' });

    const maxOrder = db.prepare('SELECT MAX(sort_order) as max_ord FROM services WHERE category_id = ?').get(category_id).max_ord || 0;
    const stmt = db.prepare(`
      INSERT INTO services (category_id, title, description, price, duration, sort_order)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    const info = stmt.run(category_id, title.trim(), (description || '').trim(), (price || '').trim(), (duration || '').trim(), maxOrder + 1);
    res.json({ success: true, id: info.lastInsertRowid });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create service.' });
  }
});

app.delete('/api/admin/services/:id', authenticateAdmin, (req, res) => {
  try {
    db.prepare('DELETE FROM services WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete service.' });
  }
});

// HERO IMAGE UPLOAD
app.post('/api/admin/hero/upload', authenticateAdmin, upload.single('hero_image'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image uploaded or invalid file format.' });
    }
    const imageUrl = `/uploads/${req.file.filename}`;
    db.prepare('INSERT OR REPLACE INTO site_settings (key, value) VALUES (?, ?)').run('hero_image_url', imageUrl);
    res.json({ success: true, image_url: imageUrl });
  } catch (err) {
    res.status(500).json({ error: 'Failed to upload hero image.' });
  }
});

// GALLERY PHOTO UPLOAD & MANAGEMENT
app.post('/api/admin/gallery/upload', authenticateAdmin, upload.single('image'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image uploaded or invalid file format.' });
    }
    const { category_id, title } = req.body;
    if (!category_id) {
      return res.status(400).json({ error: 'Category ID is required.' });
    }

    const imageUrl = `/uploads/${req.file.filename}`;
    const maxOrder = db.prepare('SELECT MAX(sort_order) as max_ord FROM gallery_items WHERE category_id = ?').get(category_id).max_ord || 0;

    const stmt = db.prepare('INSERT INTO gallery_items (category_id, title, image_url, sort_order) VALUES (?, ?, ?, ?)');
    const info = stmt.run(category_id, (title || '').trim(), imageUrl, maxOrder + 1);

    res.json({
      success: true,
      id: info.lastInsertRowid,
      image_url: imageUrl,
      title: title || ''
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to upload photo.' });
  }
});

app.delete('/api/admin/gallery/:id', authenticateAdmin, (req, res) => {
  try {
    const item = db.prepare('SELECT image_url FROM gallery_items WHERE id = ?').get(req.params.id);
    if (item && item.image_url.startsWith('/uploads/')) {
      const filePath = path.join(__dirname, 'public', item.image_url);
      if (fs.existsSync(filePath)) {
        try { fs.unlinkSync(filePath); } catch(e) {}
      }
    }
    db.prepare('DELETE FROM gallery_items WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete photo.' });
  }
});

// BOOKINGS IN ADMIN
app.get('/api/admin/bookings', authenticateAdmin, (req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM booking_requests ORDER BY created_at DESC LIMIT 100').all();
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch bookings.' });
  }
});

app.delete('/api/admin/bookings/:id', authenticateAdmin, (req, res) => {
  try {
    db.prepare('DELETE FROM booking_requests WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete booking.' });
  }
});

// CHANGE ADMIN PASSWORD
app.post('/api/admin/change-password', authenticateAdmin, (req, res) => {
  try {
    const { new_password } = req.body;
    if (!new_password || new_password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long.' });
    }

    const salt = bcrypt.genSaltSync(10);
    const hash = bcrypt.hashSync(new_password, salt);
    db.prepare('UPDATE admin_users SET password_hash = ? WHERE id = ?').run(hash, req.admin.id);

    res.json({ success: true, message: 'Password successfully updated.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update password.' });
  }
});

// -------------------------------------------------------------
// 7. HTML PAGE ROUTES
// -------------------------------------------------------------

// Dedicated admin login page route
app.get('/admin-login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin-login.html'));
});

// Admin panel dashboard route
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// Main landing page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Fallback for any other page route
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// -------------------------------------------------------------
// START SERVER
// -------------------------------------------------------------
app.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(`  Solana Beauty Studio Server Running!`);
  console.log(`  Main Website:   http://localhost:${PORT}`);
  console.log(`  Admin Login:    http://localhost:${PORT}/admin-login`);
  console.log(`  Default Admin:  admin / Solana2026!`);
  console.log(`=======================================================`);
});
