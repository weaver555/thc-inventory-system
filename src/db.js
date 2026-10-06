/**
 * SQLite database initialization and seed data.
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config();

const dbPath = process.env.DB_PATH || path.join(__dirname, '../data/thc_inventory.db');
const dataDir = path.dirname(dbPath);
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const Database = require('better-sqlite3');
const db = new Database(dbPath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

function uuid() {
  return crypto.randomUUID();
}

function initializeDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      description TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS units (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      abbreviation TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS items (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      category_id TEXT,
      unit_id TEXT,
      reorder_level REAL DEFAULT 0,
      critical_level REAL DEFAULT 0,
      target_stock REAL DEFAULT 0,
      active INTEGER DEFAULT 1,
      notes TEXT,
      source TEXT DEFAULT 'MANUAL',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY(category_id) REFERENCES categories(id),
      FOREIGN KEY(unit_id) REFERENCES units(id)
    );

    CREATE TABLE IF NOT EXISTS production_transactions (
      id TEXT PRIMARY KEY,
      item_id TEXT NOT NULL,
      quantity REAL NOT NULL,
      unit_id TEXT,
      operating_date TEXT NOT NULL,
      source TEXT NOT NULL,
      notes TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY(item_id) REFERENCES items(id),
      FOREIGN KEY(unit_id) REFERENCES units(id)
    );

    CREATE TABLE IF NOT EXISTS stock_in_transactions (
      id TEXT PRIMARY KEY,
      item_id TEXT NOT NULL,
      quantity REAL NOT NULL,
      unit_id TEXT,
      operating_date TEXT NOT NULL,
      source TEXT NOT NULL,
      reference TEXT,
      notes TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY(item_id) REFERENCES items(id),
      FOREIGN KEY(unit_id) REFERENCES units(id)
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
      unit_id TEXT,
      source TEXT,
      notes TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY(item_id) REFERENCES items(id),
      FOREIGN KEY(unit_id) REFERENCES units(id)
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

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_items_name ON items(name);
    CREATE INDEX IF NOT EXISTS idx_prod_date ON production_transactions(operating_date);
    CREATE INDEX IF NOT EXISTS idx_stockin_date ON stock_in_transactions(operating_date);
    CREATE INDEX IF NOT EXISTS idx_pc_date ON physical_counts(operating_date);
    CREATE INDEX IF NOT EXISTS idx_inventory_date ON inventory_transactions(operating_date);
  `);
}

function seedDefaultCategoriesAndUnits() {
  const categoryCount = db.prepare('SELECT COUNT(*) AS count FROM categories').get().count;
  if (categoryCount === 0) {
    const now = new Date().toISOString();
    const categories = [
      ['cat-meat', 'Meat', 'Raw and cooked meats'],
      ['cat-sauce', 'Sauce', 'Sauces and condiments'],
      ['cat-dry-goods', 'Dry Goods', 'Dry goods and pantry stock'],
      ['cat-dairy', 'Dairy', 'Dairy and cheese'],
      ['cat-vegetable', 'Vegetable', 'Vegetables and produce'],
      ['cat-beverage', 'Beverage', 'Drinks'],
      ['cat-bakery', 'Bakery', 'Bread and bakery items'],
      ['cat-fruit', 'Fruit', 'Fruit items'],
      ['cat-herb', 'Herb', 'Fresh herbs'],
      ['cat-seasoning', 'Seasoning', 'Seasonings and spices']
    ];

    const units = [
      ['unit-pcs', 'pcs', 'pcs'],
      ['unit-kg', 'kg', 'kg'],
      ['unit-container', 'container', 'container'],
      ['unit-pack', 'pack', 'pack'],
      ['unit-box', 'box', 'box'],
      ['unit-gallon', 'gallon', 'gallon'],
      ['unit-bottle', 'bottle', 'bottle'],
      ['unit-bundle', 'bundle', 'bundle']
    ];

    const categoryInsert = db.prepare('INSERT INTO categories (id, name, description, created_at) VALUES (?, ?, ?, ?)');
    const unitInsert = db.prepare('INSERT INTO units (id, name, abbreviation, created_at) VALUES (?, ?, ?, ?)');

    for (const [id, name, description] of categories) categoryInsert.run(id, name, description, now);
    for (const [id, name, abbreviation] of units) unitInsert.run(id, name, abbreviation, now);
  }
}

function seedDefaultInventoryItems() {
  const itemCount = db.prepare('SELECT COUNT(*) AS count FROM items').get().count;
  if (itemCount > 0) return;

  const now = new Date().toISOString();
  const defaults = [
    ['WINGS RAW', 'cat-meat', 'unit-pcs', 30, 10, 200],
    ['WINGS', 'cat-meat', 'unit-pcs', 30, 10, 200],
    ['PATTY', 'cat-meat', 'unit-pcs', 25, 10, 120],
    ['FRIES', 'cat-dry-goods', 'unit-kg', 5, 2, 20],
    ['CHICKEN', 'cat-meat', 'unit-pcs', 40, 15, 250],
    ['BAGNET', 'cat-meat', 'unit-pcs', 20, 8, 80],
    ['SPAM', 'cat-meat', 'unit-pcs', 10, 3, 45],
    ['BACON', 'cat-meat', 'unit-pcs', 15, 5, 60],
    ['HUNGARIAN', 'cat-sauce', 'unit-container', 4, 1, 12],
    ['CORNED BEEF', 'cat-meat', 'unit-pcs', 12, 4, 40],
    ['BURGER BUNS', 'cat-bakery', 'unit-pcs', 20, 8, 80],
    ['EGG', 'cat-dairy', 'unit-pcs', 25, 10, 100],
    ['SWEET BLEND', 'cat-sauce', 'unit-container', 3, 1, 10],
    ['MAYONNAISE', 'cat-sauce', 'unit-container', 2, 1, 10],
    ['MANG TOMAS', 'cat-sauce', 'unit-container', 2, 1, 8],
    ['ONION', 'cat-vegetable', 'unit-kg', 5, 2, 20],
    ['TOMATO', 'cat-vegetable', 'unit-kg', 5, 2, 18],
    ['PIPINO', 'cat-vegetable', 'unit-kg', 3, 1, 12],
    ['CALAMANSI', 'cat-sauce', 'unit-container', 2, 1, 8],
    ['SILI', 'cat-vegetable', 'unit-kg', 2, 1, 8],
    ['SESAME SEED', 'cat-dry-goods', 'unit-pack', 3, 1, 10],
    ['CHILI OIL', 'cat-sauce', 'unit-container', 2, 1, 10],
    ['FRIED GARLIC', 'cat-sauce', 'unit-kg', 2, 1, 8],
    ['BASIL', 'cat-herb', 'unit-bundle', 2, 1, 8],
    ['KNORR SEASONING', 'cat-sauce', 'unit-container', 2, 1, 8],
    ['KNORR CUBE', 'cat-seasoning', 'unit-pack', 2, 1, 6],
    ['PAMINTA', 'cat-seasoning', 'unit-pack', 2, 1, 8],
    ['ASIN', 'cat-seasoning', 'unit-pack', 2, 1, 8],
    ['CRISPY FRY', 'cat-dry-goods', 'unit-pack', 3, 1, 12],
    ['AJI SILI', 'cat-sauce', 'unit-container', 2, 1, 8],
    ['BUFFALO', 'cat-sauce', 'unit-container', 2, 1, 8],
    ['CHEESE', 'cat-dairy', 'unit-kg', 3, 1, 12],
    ['CREAMY', 'cat-sauce', 'unit-container', 2, 1, 8],
    ['BUTTER GARLIC', 'cat-sauce', 'unit-container', 2, 1, 8],
    ['SNOW CHEESE', 'cat-dairy', 'unit-pack', 2, 1, 8],
    ['YANGNEOM', 'cat-sauce', 'unit-gallon', 2, 1, 8],
    ['JACK\'S DANIEL', 'cat-sauce', 'unit-container', 2, 1, 8],
    ['AIOLI', 'cat-sauce', 'unit-container', 2, 1, 8],
    ['CORNSTARCH', 'cat-dry-goods', 'unit-pack', 3, 1, 10],
    ['HARINA', 'cat-dry-goods', 'unit-pack', 3, 1, 10],
    ['TOYO', 'cat-sauce', 'unit-container', 2, 1, 8],
    ['SUKA', 'cat-sauce', 'unit-container', 2, 1, 8],
    ['SUGAR', 'cat-dry-goods', 'unit-kg', 3, 1, 10],
    ['COKE', 'cat-beverage', 'unit-bottle', 4, 2, 12],
    ['WATER', 'cat-beverage', 'unit-bottle', 4, 2, 12],
    ['GASUL', 'cat-beverage', 'unit-bottle', 4, 2, 12],
    ['CHEESE POWDER', 'cat-dry-goods', 'unit-pack', 3, 1, 10],
    ['PINEAPPLE SLICES', 'cat-fruit', 'unit-pack', 3, 1, 12]
  ];

  const insert = db.prepare(`
    INSERT INTO items (id, name, category_id, unit_id, reorder_level, critical_level, target_stock, active, source, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 1, 'SYSTEM', ?, ?)
  `);

  for (const [name, categoryId, unitId, reorder, critical, target] of defaults) {
    insert.run(uuid(), name, categoryId, unitId, reorder, critical, target, now, now);
  }
}

function logAudit(tableName, recordId, action, details) {
  const insert = db.prepare(`
    INSERT INTO audit_logs (id, table_name, record_id, action, details, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  insert.run(uuid(), tableName, recordId, action, JSON.stringify(details || {}), new Date().toISOString());
}

initializeDatabase();
seedDefaultCategoriesAndUnits();
seedDefaultInventoryItems();

module.exports = {
  db,
  uuid,
  logAudit,
  initializeDatabase,
  seedDefaultCategoriesAndUnits,
  seedDefaultInventoryItems
};
