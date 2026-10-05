const Database = require('better-sqlite3');
const path = require('path');
const bcrypt = require('bcryptjs');

const dbPath = path.join(__dirname, '..', 'data', 'solana.db');
const db = new Database(dbPath);

// Enable WAL mode for high performance & reliability
db.pragma('journal_mode = WAL');

// Initialize tables
db.exec(`
  CREATE TABLE IF NOT EXISTS admin_users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    sort_order INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS services (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    price TEXT,
    duration TEXT,
    sort_order INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (category_id) REFERENCES categories (id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS gallery_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category_id INTEGER NOT NULL,
    title TEXT,
    image_url TEXT NOT NULL,
    sort_order INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (category_id) REFERENCES categories (id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS site_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS booking_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_name TEXT NOT NULL,
    client_phone TEXT NOT NULL,
    service_name TEXT,
    preferred_date TEXT,
    comment TEXT,
    status TEXT DEFAULT 'new',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// Seed default settings and initial admin if empty
const adminExists = db.prepare('SELECT id FROM admin_users LIMIT 1').get();
if (!adminExists) {
  const defaultSalt = bcrypt.genSaltSync(10);
  const defaultHash = bcrypt.hashSync('Solana2026!', defaultSalt);
  db.prepare('INSERT INTO admin_users (username, password_hash) VALUES (?, ?)').run('admin', defaultHash);
  console.log('[DB] Created default admin account: admin / Solana2026!');
}

// Seed default site settings if empty
const settingsCount = db.prepare('SELECT COUNT(*) as count FROM site_settings').get();
if (settingsCount.count === 0) {
  const insertSetting = db.prepare('INSERT INTO site_settings (key, value) VALUES (?, ?)');
  const defaultSettings = [
    ['site_title', 'Solana Beauty | Aesthetic Studio & Clinic'],
    ['tagline', 'Natural Elegance & Clinical Perfection'],
    ['phone', '+1 (555) 789-2345'],
    ['whatsapp', '15557892345'],
    ['telegram', 'solanabeauty'],
    ['instagram', 'solana.beauty.studio'],
    ['address', '450 Beverly Hills Blvd, Los Angeles, CA 90210'],
    ['working_hours', 'Mon - Sat: 9:00 AM - 8:00 PM | Sun: By Appointment'],
    ['about_text', 'Solana Beauty embodies medical-grade safety, artistry, and effortless beauty. Specializing in advanced lash architecture, micro-pigmentation, lip contouring, and brow sculpting. Every procedure is tailored to enhance your unique natural harmony in an ultra-clean, serene clinical atmosphere.']
  ];
  for (const [key, value] of defaultSettings) {
    insertSetting.run(key, value);
  }
}

// Seed default beauty categories and showcase items if empty
const categoriesCount = db.prepare('SELECT COUNT(*) as count FROM categories').get();
if (categoriesCount.count === 0) {
  const insertCat = db.prepare('INSERT INTO categories (slug, title, description, sort_order) VALUES (?, ?, ?, ?)');
  const insertSrv = db.prepare('INSERT INTO services (category_id, title, description, price, duration, sort_order) VALUES (?, ?, ?, ?, ?, ?)');
  const insertGal = db.prepare('INSERT INTO gallery_items (category_id, title, image_url, sort_order) VALUES (?, ?, ?, ?)');

  const c1 = insertCat.run('brows', 'Brow Architecture & Lamination', 'Bespoke brow shaping, organic tinting, and keratin lamination for structured, fluffy volume.', 1).lastInsertRowid;
  const c2 = insertCat.run('lashes', 'Eyelash Extensions & Lift', 'Weightless Japanese silk extensions and lash botox lifts designed for all-day comfort.', 2).lastInsertRowid;
  const c3 = insertCat.run('lips', 'Lip Blush & Micropigmentation', 'Soft velvet gradient tinting creating youthful definition, subtle volume, and natural tint.', 3).lastInsertRowid;
  const c4 = insertCat.run('skin-care', 'Clinical Facial Glow & Care', 'Medical-grade express hydration, deep pore clarifying, and soothing antioxidant treatments.', 4).lastInsertRowid;

  // Brows services
  insertSrv.run(c1, 'Signature Brow Architecture', 'Precision mapping, waxing/tweezing, and long-lasting hybrid dye tailored to face anatomy.', '$65', '45 min', 1);
  insertSrv.run(c1, 'Keratin Brow Lamination & Nourishing Treatment', 'Restructures unruly hairs, delivers high-gloss shine and lasting alignment for up to 8 weeks.', '$95', '60 min', 2);
  insertSrv.run(c1, 'Powder Brows (Ombré Micropigmentation)', 'Delicate pixel-shaded permanent makeup creating an airbrushed soft makeup effect.', '$350', '120 min', 3);

  // Lashes services
  insertSrv.run(c2, 'Classic Natural Lash Set (1:1)', 'Single extension applied to every natural lash for refined, undetectable elegance.', '$120', '75 min', 1);
  insertSrv.run(c2, 'Soft Russian Volume (2D-3D)', 'Lightweight cashmere fans giving dreamy density, fluffy look without damaging natural lashes.', '$160', '90 min', 2);
  insertSrv.run(c2, 'Keratin Lash Lift & Deep Tint', 'Dramatic natural curl infused with peptides, vitamins, and deep raven-black gloss.', '$85', '50 min', 3);

  // Lips services
  insertSrv.run(c3, 'Aquarelle Lip Blush', 'Sheer, translucent watercolor wash that enhances natural lip undertones and evens asymmetry.', '$400', '120 min', 1);
  insertSrv.run(c3, 'Velvet Contour & Full Saturation', 'Fuller coverage with defined borders and rich mineral pigments for lipstick-ready glamour.', '$450', '150 min', 2);

  // Default gallery works (high-quality Unsplash beauty placeholders with royalty-free clinical aesthetic)
  insertGal.run(c1, 'Laminated Brow Contour', 'https://images.unsplash.com/photo-1596704017254-9b121068fb31?auto=format&fit=crop&w=800&q=80', 1);
  insertGal.run(c1, 'Natural Ombre Shading', 'https://images.unsplash.com/photo-1588515724527-074a7a56616c?auto=format&fit=crop&w=800&q=80', 2);
  insertGal.run(c2, 'Classic Cashmere Lashes', 'https://images.unsplash.com/photo-1583001931096-959e9a1a6223?auto=format&fit=crop&w=800&q=80', 1);
  insertGal.run(c2, 'Fluffy Volume Lashes', 'https://images.unsplash.com/photo-1512496015851-a90fb38ba796?auto=format&fit=crop&w=800&q=80', 2);
  insertGal.run(c3, 'Nude Rose Lip Blush', 'https://images.unsplash.com/photo-1586495777744-4413f21062fa?auto=format&fit=crop&w=800&q=80', 1);
  insertGal.run(c3, 'Velvet Coral Tint', 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=800&q=80', 2);
  insertGal.run(c4, 'Clinical Glow Treatment', 'https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?auto=format&fit=crop&w=800&q=80', 1);

  console.log('[DB] Seeded beauty catalog data.');
}

module.exports = db;
