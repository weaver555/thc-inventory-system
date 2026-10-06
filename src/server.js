const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config();

const dataDir = path.resolve(__dirname, '../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = process.env.DB_PATH || path.join(dataDir, 'thc_inventory.db');
const Database = require('better-sqlite3');
const db = new Database(dbPath);

db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS items (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT,
    unit TEXT,
    reorder_level REAL DEFAULT 0,
    critical_level REAL DEFAULT 0,
    target_stock REAL DEFAULT 0,
    active INTEGER DEFAULT 1,
    notes TEXT,
    pending_review INTEGER DEFAULT 0,
    source TEXT DEFAULT 'MANUAL',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS production_transactions (
    id TEXT PRIMARY KEY,
    item_id TEXT NOT NULL,
    quantity REAL NOT NULL,
    unit TEXT,
    operating_date TEXT NOT NULL,
    source TEXT NOT NULL DEFAULT 'PRODUCTION TEAM',
    notes TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY(item_id) REFERENCES items(id)
  );

  CREATE TABLE IF NOT EXISTS stock_in_transactions (
    id TEXT PRIMARY KEY,
    item_id TEXT NOT NULL,
    quantity REAL NOT NULL,
    unit TEXT,
    operating_date TEXT NOT NULL,
    source TEXT NOT NULL,
    reference TEXT,
    notes TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY(item_id) REFERENCES items(id)
  );

  CREATE TABLE IF NOT EXISTS physical_counts (
    id TEXT PRIMARY KEY,
    item_id TEXT NOT NULL,
    operating_date TEXT NOT NULL,
    shift TEXT NOT NULL DEFAULT 'NIGHT',
    quantity REAL NOT NULL,
    notes TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY(item_id) REFERENCES items(id),
    UNIQUE(item_id, operating_date, shift)
  );

  CREATE TABLE IF NOT EXISTS inventory_transactions (
    id TEXT PRIMARY KEY,
    item_id TEXT NOT NULL,
    transaction_type TEXT NOT NULL,
    operating_date TEXT NOT NULL,
    quantity REAL NOT NULL,
    unit TEXT,
    source TEXT,
    notes TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY(item_id) REFERENCES items(id)
  );

  CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY,
    table_name TEXT NOT NULL,
    record_id TEXT NOT NULL,
    action TEXT NOT NULL,
    details TEXT,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS settings (
    id TEXT PRIMARY KEY,
    key_name TEXT NOT NULL UNIQUE,
    value TEXT,
    updated_at TEXT NOT NULL
  );
`);

const seedItems = [
  ['WINGS RAW', 'Meat', 'pcs', 30, 10, 200, 1],
  ['WINGS', 'Meat', 'pcs', 30, 10, 200, 1],
  ['PATTY', 'Meat', 'pcs', 25, 10, 120, 1],
  ['FRIES', 'Dry Goods', 'kg', 5, 2, 20, 1],
  ['CHICKEN', 'Meat', 'pcs', 40, 15, 250, 1],
  ['BAGNET', 'Meat', 'pcs', 20, 8, 80, 1],
  ['SPAM', 'Meat', 'pcs', 10, 3, 45, 1],
  ['BACON', 'Meat', 'pcs', 15, 5, 60, 1],
  ['HUNGARIAN', 'Sauce', 'container', 4, 1, 12, 1],
  ['CORNED BEEF', 'Meat', 'pcs', 12, 4, 40, 1],
  ['BURGER BUNS', 'Bakery', 'pcs', 20, 8, 80, 1],
  ['EGG', 'Dairy', 'pcs', 25, 10, 100, 1],
  ['SWEET BLEND', 'Sauce', 'container', 3, 1, 10, 1],
  ['MAYONNAISE', 'Sauce', 'container', 2, 1, 10, 1],
  ['MANG TOMAS', 'Sauce', 'container', 2, 1, 8, 1],
  ['ONION', 'Vegetable', 'kg', 5, 2, 20, 1],
  ['TOMATO', 'Vegetable', 'kg', 5, 2, 18, 1],
  ['PIPINO', 'Vegetable', 'kg', 3, 1, 12, 1],
  ['CALAMANSI', 'Sauce', 'container', 2, 1, 8, 1],
  ['SILI', 'Vegetable', 'kg', 2, 1, 8, 1],
  ['SESAME SEED', 'Dry Goods', 'pack', 3, 1, 10, 1],
  ['CHILI OIL', 'Sauce', 'container', 2, 1, 10, 1],
  ['FRIED GARLIC', 'Sauce', 'kg', 2, 1, 8, 1],
  ['BASIL', 'Herb', 'bundle', 2, 1, 8, 1],
  ['KNORR SEASONING', 'Sauce', 'container', 2, 1, 8, 1],
  ['KNORR CUBE', 'Seasoning', 'pack', 2, 1, 6, 1],
  ['PAMINTA', 'Seasoning', 'pack', 2, 1, 8, 1],
  ['ASIN', 'Seasoning', 'pack', 2, 1, 8, 1],
  ['CRISPY FRY', 'Dry Goods', 'pack', 3, 1, 12, 1],
  ['AJI SILI', 'Sauce', 'container', 2, 1, 8, 1],
  ['BUFFALO', 'Sauce', 'container', 2, 1, 8, 1],
  ['CHEESE', 'Dairy', 'kg', 3, 1, 12, 1],
  ['CREAMY', 'Sauce', 'container', 2, 1, 8, 1],
  ['BUTTER GARLIC', 'Sauce', 'container', 2, 1, 8, 1],
  ['SNOW CHEESE', 'Dairy', 'pack', 2, 1, 8, 1],
  ['YANGNEOM', 'Sauce', 'gallon', 2, 1, 8, 1],
  ['JACK\'S DANIEL', 'Sauce', 'container', 2, 1, 8, 1],
  ['AIOLI', 'Sauce', 'container', 2, 1, 8, 1],
  ['CORNSTARCH', 'Dry Goods', 'pack', 3, 1, 10, 1],
  ['HARINA', 'Dry Goods', 'pack', 3, 1, 10, 1],
  ['TOYO', 'Sauce', 'container', 2, 1, 8, 1],
  ['SUKA', 'Sauce', 'container', 2, 1, 8, 1],
  ['SUGAR', 'Dry Goods', 'kg', 3, 1, 10, 1],
  ['COKE', 'Beverage', 'bottle', 4, 2, 12, 1],
  ['WATER', 'Beverage', 'bottle', 4, 2, 12, 1],
  ['GASUL', 'Beverage', 'bottle', 4, 2, 12, 1],
  ['CHEESE POWDER', 'Dry Goods', 'pack', 3, 1, 10, 1],
  ['PINEAPPLE SLICES', 'Fruit', 'pack', 3, 1, 12, 1]
];

function uuid() {
  return crypto.randomUUID();
}

function seedDefaultItems() {
  const existing = db.prepare('SELECT COUNT(*) AS count FROM items').get();
  if (existing.count > 0) {
    return;
  }

  const now = new Date().toISOString();
  const stmt = db.prepare(`
    INSERT INTO items (id, name, category, unit, reorder_level, critical_level, target_stock, active, notes, pending_review, source, created_at, updated_at)
    VALUES (@id, @name, @category, @unit, @reorder_level, @critical_level, @target_stock, @active, @notes, @pending_review, @source, @created_at, @updated_at)
  `);

  for (const item of seedItems) {
    const [name, category, unit, reorder, critical, target, active] = item;
    stmt.run({
      id: uuid(),
      name,
      category,
      unit,
      reorder_level: reorder,
      critical_level: critical,
      target_stock: target,
      active,
      notes: '',
      pending_review: 0,
      source: 'SYSTEM',
      created_at: now,
      updated_at: now
    });
  }
}

function getDb() {
  return db;
}

function logAudit(tableName, recordId, action, details) {
  const stmt = db.prepare(`
    INSERT INTO audit_logs (id, table_name, record_id, action, details, created_at)
    VALUES (@id, @table_name, @record_id, @action, @details, @created_at)
  `);

  stmt.run({
    id: uuid(),
    table_name: tableName,
    record_id: recordId,
    action,
    details: JSON.stringify(details || {}),
    created_at: new Date().toISOString()
  });
}

seedDefaultItems();

module.exports = {
  db,
  getDb,
  uuid,
  logAudit,
  seedDefaultItems
};
