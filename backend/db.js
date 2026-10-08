const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');

const dbPath = path.join(__dirname, 'database.sqlite');
const db = new DatabaseSync(dbPath);

// Initialize database schema (2 models: users and urls)
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    phone TEXT UNIQUE NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS urls (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    original_url TEXT NOT NULL,
    short_code TEXT UNIQUE NOT NULL,
    clicks INTEGER DEFAULT 0,
    created_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );
`);

// Prepared statements for fast and safe execution
const statements = {
  findUserByPhone: db.prepare('SELECT * FROM users WHERE phone = ?'),
  findUserById: db.prepare('SELECT * FROM users WHERE id = ?'),
  insertUser: db.prepare('INSERT INTO users (phone, created_at) VALUES (?, ?)'),
  
  insertUrl: db.prepare('INSERT INTO urls (user_id, original_url, short_code, clicks, created_at) VALUES (?, ?, ?, 0, ?)'),
  findUrlsByUserId: db.prepare('SELECT * FROM urls WHERE user_id = ? ORDER BY id DESC'),
  findUrlByCode: db.prepare('SELECT * FROM urls WHERE short_code = ?'),
  incrementClicks: db.prepare('UPDATE urls SET clicks = clicks + 1 WHERE id = ?')
};

function findOrCreateUser(phone) {
  let user = statements.findUserByPhone.get(phone);
  if (!user) {
    const createdAt = new Date().toISOString();
    const result = statements.insertUser.run(phone, createdAt);
    user = { id: Number(result.lastInsertRowid), phone, created_at: createdAt };
  }
  return user;
}

function findUserById(id) {
  return statements.findUserById.get(id);
}

function createUrl(userId, originalUrl, shortCode) {
  const createdAt = new Date().toISOString();
  const result = statements.insertUrl.run(userId, originalUrl, shortCode, createdAt);
  return {
    id: Number(result.lastInsertRowid),
    user_id: userId,
    original_url: originalUrl,
    short_code: shortCode,
    clicks: 0,
    created_at: createdAt
  };
}

function getUrlsByUser(userId) {
  return statements.findUrlsByUserId.all(userId);
}

function getUrlByCode(code) {
  return statements.findUrlByCode.get(code);
}

function recordClick(urlId) {
  statements.incrementClicks.run(urlId);
}

module.exports = {
  findOrCreateUser,
  findUserById,
  createUrl,
  getUrlsByUser,
  getUrlByCode,
  recordClick
};
