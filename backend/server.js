require('dotenv').config();
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const crypto = require('node:crypto');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'urlshortener-workshop-secret-key-2026';
const MINIMOTH_API_KEY = process.env.MINIMOTH_API_KEY || '';
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;

// Middleware
app.use(cors());
app.use(express.json());

// Helper: Normalize phone number (defaults to +91 if 10-digit)
function normalizePhone(phone) {
  if (!phone) return '';
  const cleaned = phone.replace(/[\s-]/g, '');
  if (/^\d{10}$/.test(cleaned)) {
    return `+91${cleaned}`;
  }
  return cleaned.startsWith('+') ? cleaned : `+${cleaned}`;
}

// Authentication middleware
function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: 'Authorization token required' });
  }
  const token = authHeader.split(' ')[1];
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, error: 'Invalid or expired session' });
  }
}

// ==========================================
// 5 BACKEND API ENDPOINTS
// ==========================================

// 1. POST /api/auth/send-otp (Send OTP via Minimoth)
app.post('/api/auth/send-otp', async (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone) {
      return res.status(400).json({ success: false, error: 'Phone number is required' });
    }

    const formattedPhone = normalizePhone(phone);
    if (!/^\+[1-9]\d{9,14}$/.test(formattedPhone)) {
      return res.status(400).json({ success: false, error: 'Please enter a valid phone number (e.g. +919876543210)' });
    }

    // Call Minimoth API if API key is provided
    const isLiveKey = MINIMOTH_API_KEY && !MINIMOTH_API_KEY.includes('your_minimoth_api_key');
    if (isLiveKey) {
      const response = await fetch('https://api.minimoth.dev/v1/otp/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Api-Key': MINIMOTH_API_KEY
        },
        body: JSON.stringify({ phone: formattedPhone })
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        return res.status(response.status).json({
          success: false,
          error: data.message || data.error || 'Failed to send OTP via Minimoth'
        });
      }

      return res.json({
        success: true,
        message: 'OTP sent to your phone via WhatsApp/SMS!'
      });
    }

    // Demo/Sandbox fallback for workshop testing without live key
    console.log(`[Minimoth Demo] OTP for ${formattedPhone} is 123456`);
    return res.json({
      success: true,
      message: 'Demo Mode: Use OTP code 123456 (Set MINIMOTH_API_KEY in .env for live delivery)',
      isDemo: true
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message || 'Server error sending OTP' });
  }
});

// 2. POST /api/auth/verify-otp (Verify OTP via Minimoth & Register/Login)
app.post('/api/auth/verify-otp', async (req, res) => {
  try {
    const { phone, code } = req.body;
    if (!phone || !code) {
      return res.status(400).json({ success: false, error: 'Phone and 6-digit OTP code are required' });
    }

    const formattedPhone = normalizePhone(phone);
    const cleanCode = String(code).trim();

    // Verify against Minimoth API if live key is active
    const isLiveKey = MINIMOTH_API_KEY && !MINIMOTH_API_KEY.includes('your_minimoth_api_key');
    if (isLiveKey) {
      const response = await fetch('https://api.minimoth.dev/v1/otp/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Api-Key': MINIMOTH_API_KEY
        },
        body: JSON.stringify({ phone: formattedPhone, code: cleanCode })
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        return res.status(response.status).json({
          success: false,
          error: data.message || data.error || 'Invalid OTP code'
        });
      }
    } else {
      // Demo mode OTP check
      if (cleanCode !== '123456') {
        return res.status(400).json({ success: false, error: 'Invalid OTP code. (Demo OTP is 123456)' });
      }
    }

    // Register or retrieve user in SQLite
    const user = db.findOrCreateUser(formattedPhone);
    const token = jwt.sign({ id: user.id, phone: user.phone }, JWT_SECRET, { expiresIn: '7d' });

    return res.json({
      success: true,
      message: 'Logged in successfully',
      token,
      user: {
        id: user.id,
        phone: user.phone,
        created_at: user.created_at
      }
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message || 'Server error verifying OTP' });
  }
});

// 3. POST /api/urls (Create shortened URL)
app.post('/api/urls', authenticate, (req, res) => {
  try {
    const { originalUrl } = req.body;
    if (!originalUrl) {
      return res.status(400).json({ success: false, error: 'Destination URL is required' });
    }

    let parsedUrl;
    try {
      parsedUrl = new URL(originalUrl);
      if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
        throw new Error();
      }
    } catch {
      return res.status(400).json({ success: false, error: 'Please enter a valid URL starting with http:// or https://' });
    }

    // Generate unique 6-character short code
    const shortCode = crypto.randomBytes(4).toString('base64url').slice(0, 6);
    const newUrl = db.createUrl(req.user.id, parsedUrl.href, shortCode);

    return res.status(201).json({
      success: true,
      url: {
        ...newUrl,
        shortUrl: `${BASE_URL}/${newUrl.short_code}`
      }
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message || 'Failed to shorten URL' });
  }
});

// 4. GET /api/urls (Fetch all URLs created by logged-in user)
app.get('/api/urls', authenticate, (req, res) => {
  try {
    const urls = db.getUrlsByUser(req.user.id);
    const enrichedUrls = urls.map(url => ({
      ...url,
      shortUrl: `${BASE_URL}/${url.short_code}`
    }));

    return res.json({
      success: true,
      urls: enrichedUrls
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message || 'Failed to retrieve URLs' });
  }
});

// Root endpoint: Redirect to frontend UI when visiting http://localhost:5000 directly
app.get('/', (req, res) => {
  res.redirect('http://localhost:5173');
});

// 5. GET /:code (Redirect short URL to destination)
app.get('/:code', (req, res) => {
  try {
    const { code } = req.params;
    const url = db.getUrlByCode(code);

    if (!url) {
      return res.status(404).send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Link Not Found - URLShortener</title>
          <style>
            body {
              margin: 0;
              min-height: 100vh;
              display: flex;
              align-items: center;
              justify-content: center;
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              background: #090d16;
              color: #f1f5f9;
              padding: 1rem;
            }
            .card {
              background: #111827;
              border: 1px solid #1f2937;
              border-radius: 1rem;
              padding: 2.5rem;
              max-width: 420px;
              text-align: center;
              box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5);
            }
            h1 { font-size: 3rem; margin: 0; color: #f43f5e; font-weight: 800; }
            h2 { margin: 0.5rem 0 1rem; font-size: 1.25rem; }
            p { color: #94a3b8; font-size: 0.95rem; line-height: 1.5; margin-bottom: 2rem; }
            a {
              display: inline-block;
              background: linear-gradient(135deg, #6366f1, #8b5cf6);
              color: #fff;
              text-decoration: none;
              padding: 0.75rem 1.75rem;
              border-radius: 0.5rem;
              font-weight: 600;
              transition: opacity 0.2s;
            }
            a:hover { opacity: 0.9; }
          </style>
        </head>
        <body>
          <div class="card">
            <h1>404</h1>
            <h2>Short Link Not Found</h2>
            <p>The short link you requested does not exist or has been removed.</p>
            <a href="http://localhost:5173">Go to URLShortener</a>
          </div>
        </body>
        </html>
      `);
    }

    // Increment click count and redirect (HTTP 302)
    db.recordClick(url.id);
    return res.redirect(url.original_url);
  } catch (error) {
    return res.status(500).send('Internal Server Error during redirection');
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`⚡ URLShortener backend running on http://localhost:${PORT}`);
  console.log(`🔐 Minimoth API: ${MINIMOTH_API_KEY && !MINIMOTH_API_KEY.includes('your_minimoth') ? 'Live Key Loaded' : 'Demo Mode (Code: 123456)'}`);
});
