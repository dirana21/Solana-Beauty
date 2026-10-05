# Solana Beauty — Project & Deployment Guide (English)

**Solana Beauty** is a high-performance, responsive luxury aesthetic studio & cosmetic clinic website (brows, lashes, lips, clinical skincare) equipped with a self-contained content management portal designed for ease of use.

The project is built specifically for the **US market** (US phone formatting, USD currency, Beverly Hills CA demo localization, Google US SEO optimization, Schema.org `BeautySalon` structured data).

---

## 🔑 Administrative Portal Credentials

- **Admin Login Route:** `/admin-login` (e.g., `https://your-domain.com/admin-login` or `http://localhost:3000/admin-login`)
- **Dashboard Route:** `/admin`
- **Default Username:** `admin`
- **Default Password:** `Solana2026!`
*(The password can be changed directly inside the Studio Contacts tab)*

---

## 📁 Project Architecture & File Breakdown

```
Solana-Beauty/
│
├── server.js               # Main Node.js Express server.
│                           # Handles REST API, routing, security headers (Helmet, CORS),
│                           # anti-bruteforce rate limiting, file upload handling (Multer),
│                           # and JWT/Cookie authentication.
│
├── package.json            # NPM dependencies and run scripts.
├── .env                    # Environment variables (PORT, JWT_SECRET).
│
├── data/
│   ├── db.js               # SQLite database setup (Better-SQLite3, WAL mode enabled).
│   │                       # Automatically seeds initial categories, services, and credentials.
│   └── solana.db           # SQLite database file containing all live services, settings, and leads.
│
├── public/                 # Static web assets served by the Express backend:
│   ├── index.html          # Main client-facing website (Hero, Services, Portfolio, Booking, SEO).
│   ├── admin.html          # Administrative dashboard (Manage services, prices, photos, leads, settings).
│   ├── admin-login.html    # Standalone secure sign-in portal.
│   ├── robots.txt          # Search engine crawler instructions.
│   ├── sitemap.xml         # XML sitemap for Google & Bing indexing.
│   ├── data-fallback.json  # Fallback JSON dataset for static preview (GitHub Pages).
│   ├── css/
│   │   └── style.css       # Clean clinical luxury design (Glassmorphism, mobile-first, 100dvh).
│   ├── js/
│   │   ├── main.js         # Frontend engine (Dynamic catalog rendering, native modal lightbox, booking form).
│   │   └── admin.js        # Admin management engine (CRUD, file uploads, interactive onboarding guide).
│   └── uploads/            # Directory where user-uploaded treatment & hero photos are stored.
│
├── README.md               # Russian documentation & transfer instructions.
└── README_EN.md            # English documentation for US host/developer (this file).
```

---

## 🚀 Local Quickstart (Development & Testing)

1. Ensure **Node.js** (v18.x, v20.x, or v22.x) is installed on the machine.
2. Open terminal in the project directory.
3. Install dependencies:
   ```bash
   npm install
   ```
4. Start the server:
   ```bash
   node server.js
   ```
   *or:*
   ```bash
   npm start
   ```
5. Open in browser:
   - Client Site: **http://localhost:3000**
   - Admin Login: **http://localhost:3000/admin-login**

---

## 🌐 Production Deployment Guide (US Hosting / Domain Setup)

The system is zero-configuration and does not require complex external SQL servers (MySQL/PostgreSQL) — it runs with an ultra-fast embedded SQLite database in WAL mode.

### Option A: VPS / Cloud Instance (AWS Lightsail, DigitalOcean, Linode, Hetzner)
1. Clone or copy the project files to `/var/www/solana-beauty`.
2. Install production dependencies:
   ```bash
   npm install --production
   ```
3. Run with PM2 process manager for 24/7 uptime and auto-restart:
   ```bash
   npm install -g pm2
   pm2 start server.js --name "solana-beauty"
   pm2 startup
   pm2 save
   ```
4. Setup Nginx as Reverse Proxy:
   ```nginx
   server {
       server_name yourdomain.com www.yourdomain.com;

       location / {
           proxy_pass http://localhost:3000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_cache_bypass $http_upgrade;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto $scheme;
       }
   }
   ```
5. Obtain free SSL certificate with Let's Encrypt:
   ```bash
   certbot --nginx -d yourdomain.com -d www.yourdomain.com
   ```

### Option B: Cloud App Platforms (Render, Railway, Heroku)
1. Link GitHub repository `Solana-Beauty`.
2. Set Build Command: `npm install`
3. Set Start Command: `node server.js`
4. Attach Persistent Volume to `/data` and `/public/uploads` to preserve uploaded images and appointments across rebuilds.

---

## 📍 Marketing Pixels & Tracking Code Areas

Clear code markers are already placed in `public/index.html`:

1. **Inside `<head>` (Lines ~60–90):**
   ```html
   <!-- ======================================================================
   [PIXEL INSERTION AREA: HEAD]
   PASTE YOUR META PIXEL (FACEBOOK), TIKTOK PIXEL, GOOGLE TAG (GTAG.JS), 
   OR GOOGLE TAG MANAGER CODE DIRECTLY BETWEEN THE MARKERS BELOW:
   ====================================================================== -->
   <!-- START: PIXEL / ANALYTICS HEAD CODE -->

   <!-- PASTE CODE HERE -->

   <!-- END: PIXEL / ANALYTICS HEAD CODE -->
   ```

2. **Top of `<body>` (Lines ~105–120):**
   ```html
   <!-- ======================================================================
   [PIXEL INSERTION AREA: BODY (NOSCRIPT)]
   PASTE YOUR META PIXEL NOSCRIPT / GTM NOSCRIPT DIRECTLY BELOW:
   ====================================================================== -->
   <!-- START: PIXEL NOSCRIPT CODE -->

   <!-- PASTE NOSCRIPT CODE HERE -->

   <!-- END: PIXEL NOSCRIPT CODE -->
   ```

---

## 🛡️ Security Architecture

- **Password Storage:** Salted `bcryptjs` hashing.
- **Session Tokens:** `HttpOnly`, `SameSite: Lax` JWT authentication.
- **Brute-force Mitigation:** `express-rate-limit` (10 login attempts per 15 minutes per IP).
- **HTTP Protection:** `Helmet` CSP & anti-clickjacking security headers.
- **Safe File Uploads:** Multer with strict MIME and extension validation (JPG, PNG, WebP) and safe random name generation to prevent path traversal.
