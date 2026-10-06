/**
 * Express routes and server logic.
 */

const express = require('express');
const path = require('path');
const dotenv = require('dotenv');
const { db, uuid, logAudit } = require('./db');
const { parseQuantity, formatQuantity } = require('./utils/fraction');
const { calculateInventorySnapshot } = require('./services/inventoryEngine');

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT || 4000);
const publicPath = path.join(__dirname, '../public');

app.use(express.json({ limit: '2mb' }));
app.use(express.static(publicPath));

function validateQuantity(value, fieldLabel) {
  const parsed = parseQuantity(value);
  if (parsed === null || Number.isNaN(parsed) || parsed < 0) {
    throw new Error(`Invalid ${fieldLabel}. Please enter a whole number or fraction such as 1/2, 3/4, or 2 1/2.`);
  }
  return parsed;
}

function getItemById(itemId) {
  const item = db.prepare(`
    SELECT i.*, c.name AS category_name, u.name AS unit_name
    FROM items i
    LEFT JOIN categories c ON c.id = i.category_id
    LEFT JOIN units u ON u.id = i.unit_id
    WHERE i.id = ?
  `).get(itemId);

  if (!item) {
    throw new Error('Unknown item. Please select a valid inventory item.');
  }

  return item;
}

function getPreviousPhysicalEnding(itemId, date) {
  const row = db.prepare(`
    SELECT quantity
    FROM physical_counts
    WHERE item_id = ? AND operating_date < ?
    ORDER BY operating_date DESC, created_at DESC
    LIMIT 1
  `).get(itemId, date);

  return row ? Number(row.quantity) : 0;
}

function getDailySummaryForItem(itemId, operatingDate) {
  const item = getItemById(itemId);
  const beginning = getPreviousPhysicalEnding(itemId, operatingDate);

  const production = db.prepare(`
    SELECT COALESCE(SUM(quantity), 0) AS total
    FROM production_transactions
    WHERE item_id = ? AND operating_date = ?
  `).get(itemId, operatingDate)?.total || 0;

  const stocksIn = db.prepare(`
    SELECT COALESCE(SUM(quantity), 0) AS total
    FROM stock_in_transactions
    WHERE item_id = ? AND operating_date = ?
  `).get(itemId, operatingDate)?.total || 0;

  const endingRow = db.prepare(`
    SELECT quantity
    FROM physical_counts
    WHERE item_id = ? AND operating_date = ? AND shift = 'NIGHT'
    ORDER BY created_at DESC
    LIMIT 1
  `).get(itemId, operatingDate);

  const physicalEnding = endingRow ? Number(endingRow.quantity) : 0;

  const snapshot = calculateInventorySnapshot({
    beginning,
    production,
    stocksIn,
    physicalEnding,
    item
  });

  return {
    itemId: item.id,
    itemName: item.name,
    categoryName: item.category_name,
    unitName: item.unit_name,
    ...snapshot
  };
}

app.get('/api/health', (req, res) => {
  res.json({ ok: true, message: 'THC Inventory System is up.' });
});

app.get('/api/categories', (req, res) => {
  const rows = db.prepare('SELECT * FROM categories ORDER BY name ASC').all();
  res.json(rows);
});

app.get('/api/units', (req, res) => {
  const rows = db.prepare('SELECT * FROM units ORDER BY name ASC').all();
  res.json(rows);
});

app.get('/api/items', (req, res) => {
  const rows = db.prepare(`
    SELECT i.*, c.name AS category_name, u.name AS unit_name
    FROM items i
    LEFT JOIN categories c ON c.id = i.category_id
    LEFT JOIN units u ON u.id = i.unit_id
    ORDER BY i.name ASC
  `).all();
  res.json(rows);
});

app.get('/api/items/active', (req, res) => {
  const rows = db.prepare(`
    SELECT i.*, c.name AS category_name, u.name AS unit_name
    FROM items i
    LEFT JOIN categories c ON c.id = i.category_id
    LEFT JOIN units u ON u.id = i.unit_id
    WHERE i.active = 1
    ORDER BY i.name ASC
  `).all();
  res.json(rows);
});

app.post('/api/items', (req, res) => {
  try {
    const { name, category_id, unit_id, reorder_level, critical_level, target_stock, notes } = req.body || {};

    if (!name || !String(name).trim()) {
      return res.status(400).json({ error: 'Item name is required.' });
    }
    if (!category_id) { return res.status(400).json({ error: 'Category is required.' }); }
    if (!unit_id) { return res.status(400).json({ error: 'Unit is required.' }); }

    const itemId = uuid();
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO items (id, name, category_id, unit_id, reorder_level, critical_level, target_stock, active, notes, source, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, 'MANUAL', ?, ?)
    `).run(itemId, String(name).trim(), category_id, unit_id, Number(reorder_level || 0), Number(critical_level || 0), Number(target_stock || 0), notes || '', now, now);

    logAudit('items', itemId, 'create', { name, category_id, unit_id });

    const record = getItemById(itemId);
    res.status(201).json(record);
  } catch (error) {
    res.status(400).json({ error: error.message || 'Unable to create item.' });
  }
});

app.put('/api/items/:id', (req, res) => {
  try {
    const itemId = req.params.id;
    const current = getItemById(itemId);
    const { name, category_id, unit_id, reorder_level, critical_level, target_stock, active, notes } = req.body || {};
    const now = new Date().toISOString();

    db.prepare(`
      UPDATE items
      SET name = ?, category_id = ?, unit_id = ?, reorder_level = ?, critical_level = ?, target_stock = ?, active = ?, notes = ?, updated_at = ?
      WHERE id = ?
    `).run(
      name !== undefined ? String(name).trim() : current.name,
      category_id !== undefined ? category_id : current.category_id,
      unit_id !== undefined ? unit_id : current.unit_id,
      reorder_level !== undefined ? Number(reorder_level) : current.reorder_level,
      critical_level !== undefined ? Number(critical_level) : current.critical_level,
      target_stock !== undefined ? Number(target_stock) : current.target_stock,
      active !== undefined ? (active ? 1 : 0) : current.active,
      notes !== undefined ? notes : current.notes,
      now,
      itemId
    );

    logAudit('items', itemId, 'update', { itemId, name, category_id, unit_id, reorder_level, critical_level, target_stock, active });
    res.json(getItemById(itemId));
  } catch (error) {
    res.status(400).json({ error: error.message || 'Unable to update item.' });
  }
});

app.get('/api/production', (req, res) => {
  const date = req.query.date || new Date().toISOString().slice(0, 10);
  const rows = db.prepare(`
    SELECT p.*, i.name AS item_name, u.name AS unit_name
    FROM production_transactions p
    LEFT JOIN items i ON i.id = p.item_id
    LEFT JOIN units u ON u.id = p.unit_id
    WHERE p.operating_date = ?
    ORDER BY p.created_at DESC
  `).all(date);
  res.json(rows);
});

app.post('/api/production', (req, res) => {
  try {
    const { item_id, date, quantity, notes } = req.body || {};
    const operatingDate = date || new Date().toISOString().slice(0, 10);
    const parsed = validateQuantity(quantity, 'production quantity');
    const item = getItemById(item_id);
    const id = uuid();
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO production_transactions (id, item_id, quantity, unit_id, operating_date, source, notes, created_at)
      VALUES (?, ?, ?, ?, ?, 'PRODUCTION TEAM', ?, ?)
    `).run(id, item.id, parsed, item.unit_id, operatingDate, notes || '', now);

    db.prepare(`
      INSERT INTO inventory_transactions (id, item_id, transaction_type, operating_date, quantity, unit_id, source, notes, created_at)
      VALUES (?, ?, 'PRODUCTION', ?, ?, ?, 'PRODUCTION TEAM', ?, ?)
    `).run(uuid(), item.id, operatingDate, parsed, item.unit_id, notes || '', now);

    logAudit('production_transactions', id, 'create', { item_id: item.id, quantity: parsed, operating_date: operatingDate });

    const row = db.prepare(`
      SELECT p.*, i.name AS item_name, u.name AS unit_name
      FROM production_transactions p
      LEFT JOIN items i ON i.id = p.item_id
      LEFT JOIN units u ON u.id = p.unit_id
      WHERE p.id = ?
    `).get(id);

    res.status(201).json(row);
  } catch (error) {
    res.status(400).json({ error: error.message || 'Unable to save production record.' });
  }
});

app.get('/api/stocks-in', (req, res) => {
  const date = req.query.date || new Date().toISOString().slice(0, 10);
  const rows = db.prepare(`
    SELECT s.*, i.name AS item_name, u.name AS unit_name
    FROM stock_in_transactions s
    LEFT JOIN items i ON i.id = s.item_id
    LEFT JOIN units u ON u.id = s.unit_id
    WHERE s.operating_date = ?
    ORDER BY s.created_at DESC
  `).all(date);
  res.json(rows);
});

app.post('/api/stocks-in', (req, res) => {
  try {
    const { item_id, date, quantity, source, reference, notes } = req.body || {};
    const operatingDate = date || new Date().toISOString().slice(0, 10);
    const parsed = validateQuantity(quantity, 'stock in quantity');
    const item = getItemById(item_id);
    const id = uuid();
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO stock_in_transactions (id, item_id, quantity, unit_id, operating_date, source, reference, notes, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, item.id, parsed, item.unit_id, operatingDate, source || 'PURCHASE', reference || '', notes || '', now);

    db.prepare(`
      INSERT INTO inventory_transactions (id, item_id, transaction_type, operating_date, quantity, unit_id, source, notes, created_at)
      VALUES (?, ?, 'STOCKS_IN', ?, ?, ?, ?, ?, ?)
    `).run(uuid(), item.id, operatingDate, parsed, item.unit_id, source || 'PURCHASE', notes || '', now);

    logAudit('stock_in_transactions', id, 'create', { item_id: item.id, quantity: parsed, operating_date: operatingDate });

    const row = db.prepare(`
      SELECT s.*, i.name AS item_name, u.name AS unit_name
      FROM stock_in_transactions s
      LEFT JOIN items i ON i.id = s.item_id
      LEFT JOIN units u ON u.id = s.unit_id
      WHERE s.id = ?
    `).get(id);

    res.status(201).json(row);
  } catch (error) {
    res.status(400).json({ error: error.message || 'Unable to save stock in record.' });
  }
});

app.get('/api/physical-counts', (req, res) => {
  const date = req.query.date || new Date().toISOString().slice(0, 10);
  const rows = db.prepare(`
    SELECT p.*, i.name AS item_name, u.name AS unit_name
    FROM physical_counts p
    LEFT JOIN items i ON i.id = p.item_id
    LEFT JOIN units u ON u.id = i.unit_id
    WHERE p.operating_date = ?
    ORDER BY i.name ASC
  `).all(date);
  res.json(rows);
});

app.post('/api/physical-counts', (req, res) => {
  try {
    const { item_id, date, quantity, notes, shift } = req.body || {};
    const operatingDate = date || new Date().toISOString().slice(0, 10);
    const parsed = validateQuantity(quantity, 'physical count quantity');
    const selectedShift = shift || 'NIGHT';
    const item = getItemById(item_id);

    const existing = db.prepare(`
      SELECT id FROM physical_counts
      WHERE item_id = ? AND operating_date = ? AND shift = ?
    `).get(item.id, operatingDate, selectedShift);

    if (existing) {
      return res.status(409).json({ error: 'Duplicate physical count detected for the same date + shift + item.' });
    }

    const id = uuid();
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO physical_counts (id, item_id, operating_date, shift, quantity, notes, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, item.id, operatingDate, selectedShift, parsed, notes || '', now, now);

    db.prepare(`
      INSERT INTO inventory_transactions (id, item_id, transaction_type, operating_date, quantity, unit_id, source, notes, created_at)
      VALUES (?, ?, 'PHYSICAL_COUNT', ?, ?, ?, 'NIGHT OPERATIONS', ?, ?)
    `).run(uuid(), item.id, operatingDate, parsed, item.unit_id, notes || '', now);

    logAudit('physical_counts', id, 'create', { item_id: item.id, operating_date: operatingDate, quantity: parsed });

    const row = db.prepare(`
      SELECT p.*, i.name AS item_name, u.name AS unit_name
      FROM physical_counts p
      LEFT JOIN items i ON i.id = p.item_id
      LEFT JOIN units u ON u.id = i.unit_id
      WHERE p.id = ?
    `).get(id);

    res.status(201).json(row);
  } catch (error) {
    res.status(400).json({ error: error.message || 'Unable to save physical count.' });
  }
});

app.put('/api/physical-counts/:id', (req, res) => {
  try {
    const countId = req.params.id;
    const { quantity, notes } = req.body || {};
    const parsed = validateQuantity(quantity, 'physical count quantity');
    const now = new Date().toISOString();

    db.prepare(`
      UPDATE physical_counts
      SET quantity = ?, notes = ?, updated_at = ?
      WHERE id = ?
    `).run(parsed, notes || '', now, countId);

    logAudit('physical_counts', countId, 'update', { quantity: parsed });
    const row = db.prepare(`
      SELECT p.*, i.name AS item_name, u.name AS unit_name
      FROM physical_counts p
      LEFT JOIN items i ON i.id = p.item_id
      LEFT JOIN units u ON u.id = i.unit_id
      WHERE p.id = ?
    `).get(countId);

    res.json(row);
  } catch (error) {
    res.status(400).json({ error: error.message || 'Unable to update physical count.' });
  }
});

app.get('/api/dashboard', (req, res) => {
  const date = req.query.date || new Date().toISOString().slice(0, 10);
  const items = db.prepare('SELECT * FROM items WHERE active = 1').all();

  let totalItems = 0;
  let outOfStock = 0;
  let criticalLow = 0;
  let lowStock = 0;
  let totalUsage = 0;
  const lowStockItems = [];
  const replenishmentItems = [];

  for (const item of items) {
    totalItems += 1;
    const summary = getDailySummaryForItem(item.id, date);
    if (summary.physicalEnding <= 0) outOfStock += 1;
    if (summary.physicalEnding > 0 && summary.physicalEnding <= Number(item.critical_level || 0)) criticalLow += 1;
    if (summary.physicalEnding > 0 && summary.physicalEnding <= Number(item.reorder_level || 0)) lowStock += 1;
    totalUsage += summary.actualUsage;

    if (summary.physicalEnding <= Number(item.reorder_level || 0)) {
      lowStockItems.push({
        name: item.name,
        unit: item.unit_name,
        quantity: summary.formattedPhysicalEnding,
        status: summary.status,
        recommendation: summary.recommendation
      });
    }

    if (summary.suggestedReplenishment > 0) {
      replenishmentItems.push({
        name: item.name,
        unit: item.unit_name,
        replenishment: summary.formattedSuggestedReplenishment,
        status: summary.status
      });
    }
  }

  const productionTotal = db.prepare('SELECT COUNT(*) AS count FROM production_transactions WHERE operating_date = ?').get(date).count;
  const stockInTotal = db.prepare('SELECT COUNT(*) AS count FROM stock_in_transactions WHERE operating_date = ?').get(date).count;

  const recentActivity = db.prepare(`
    SELECT 'PRODUCTION' AS type, p.operating_date, i.name AS item_name, p.quantity, u.name AS unit_name, p.source
    FROM production_transactions p
    LEFT JOIN items i ON i.id = p.item_id
    LEFT JOIN units u ON u.id = p.unit_id
    WHERE p.operating_date = ?
    UNION ALL
    SELECT 'STOCKS_IN', s.operating_date, i.name, s.quantity, u.name, s.source
    FROM stock_in_transactions s
    LEFT JOIN items i ON i.id = s.item_id
    LEFT JOIN units u ON u.id = s.unit_id
    WHERE s.operating_date = ?
    UNION ALL
    SELECT 'PHYSICAL_COUNT', p.operating_date, i.name, p.quantity, u.name, 'NIGHT OPERATIONS'
    FROM physical_counts p
    LEFT JOIN items i ON i.id = p.item_id
    LEFT JOIN units u ON u.id = i.unit_id
    WHERE p.operating_date = ?
    ORDER BY operating_date DESC
    LIMIT 25
  `).all(date, date, date);

  res.json({
    date,
    totalItems,
    outOfStock,
    criticalLow,
    lowStock,
    totalProductionToday: productionTotal,
    totalStocksInToday: stockInTotal,
    totalActualUsageToday: formatQuantity(totalUsage),
    itemsRequiringReplenishment: replenishmentItems.length,
    lowStockItems,
    replenishmentItems,
    recentActivity
  });
});

app.get('/api/reports/daily', (req, res) => {
  const date = req.query.date || new Date().toISOString().slice(0, 10);
  const items = db.prepare('SELECT * FROM items WHERE active = 1 ORDER BY name ASC').all();
  const rows = items.map((item) => getDailySummaryForItem(item.id, date));
  res.json(rows);
});

app.get('/api/reports/production', (req, res) => {
  const date = req.query.date || new Date().toISOString().slice(0, 10);
  const rows = db.prepare(`
    SELECT p.*, i.name AS item_name, u.name AS unit_name
    FROM production_transactions p
    LEFT JOIN items i ON i.id = p.item_id
    LEFT JOIN units u ON u.id = p.unit_id
    WHERE p.operating_date = ?
    ORDER BY i.name ASC, p.created_at DESC
  `).all(date);
  res.json(rows);
});

app.get('/api/reports/night', (req, res) => {
  const date = req.query.date || new Date().toISOString().slice(0, 10);
  const rows = db.prepare(`
    SELECT p.*, i.name AS item_name, u.name AS unit_name
    FROM physical_counts p
    LEFT JOIN items i ON i.id = p.item_id
    LEFT JOIN units u ON u.id = i.unit_id
    WHERE p.operating_date = ?
    ORDER BY i.name ASC
  `).all(date);

  const result = rows.map((row) => {
    const summary = getDailySummaryForItem(row.item_id, date);
    return {
      ...row,
      beginning: summary.formattedBeginning,
      production: summary.formattedProduction,
      stocksIn: summary.formattedStocksIn,
      totalAvailable: summary.formattedTotalAvailable,
      actualUsage: summary.formattedActualUsage,
      status: summary.status,
      recommendation: summary.recommendation
    };
  });

  res.json(result);
});

app.get('/api/item-history/:id', (req, res) => {
  const itemId = req.params.id;
  const item = getItemById(itemId);
  const history = db.prepare(`
    SELECT it.*, u.name AS unit_name
    FROM inventory_transactions it
    LEFT JOIN units u ON u.id = it.unit_id
    WHERE it.item_id = ?
    ORDER BY it.operating_date DESC, it.created_at DESC
  `).all(itemId);
  res.json({ item, history });
});

app.get('/api/audit-logs', (req, res) => {
  const rows = db.prepare('SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 100').all();
  res.json(rows);
});

function csvFromRows(rows) {
  if (!rows || rows.length === 0) return '';
  const headers = Object.keys(rows[0]);
  const lines = [headers.join(',')];
  for (const row of rows) {
    lines.push(headers.map((key) => JSON.stringify(row[key] ?? '')).join(','));
  }
  return lines.join('\n');
}

app.get('/api/export/items', (req, res) => {
  const rows = db.prepare(`
    SELECT i.id, i.name, c.name AS category, u.name AS unit, i.reorder_level, i.critical_level, i.target_stock, i.active, i.created_at, i.updated_at
    FROM items i
    LEFT JOIN categories c ON c.id = i.category_id
    LEFT JOIN units u ON u.id = i.unit_id
    ORDER BY i.name ASC
  `).all();

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="items.csv"');
  res.send(csvFromRows(rows));
});

app.get('/api/export/production/:date', (req, res) => {
  const rows = db.prepare(`
    SELECT p.id, i.name AS item_name, p.quantity, u.name AS unit, p.operating_date, p.source, p.notes, p.created_at
    FROM production_transactions p
    LEFT JOIN items i ON i.id = p.item_id
    LEFT JOIN units u ON u.id = p.unit_id
    WHERE p.operating_date = ?
    ORDER BY p.created_at DESC
  `).all(req.params.date);

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="production_${req.params.date}.csv"`);
  res.send(csvFromRows(rows));
});

app.get('/api/export/stocks-in/:date', (req, res) => {
  const rows = db.prepare(`
    SELECT s.id, i.name AS item_name, s.quantity, u.name AS unit, s.operating_date, s.source, s.reference, s.notes, s.created_at
    FROM stock_in_transactions s
    LEFT JOIN items i ON i.id = s.item_id
    LEFT JOIN units u ON u.id = s.unit_id
    WHERE s.operating_date = ?
    ORDER BY s.created_at DESC
  `).all(req.params.date);

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="stocks_in_${req.params.date}.csv"`);
  res.send(csvFromRows(rows));
});

app.get('/api/export/physical-counts/:date', (req, res) => {
  const rows = db.prepare(`
    SELECT p.id, i.name AS item_name, p.quantity, u.name AS unit, p.operating_date, p.shift, p.notes, p.created_at
    FROM physical_counts p
    LEFT JOIN items i ON i.id = p.item_id
    LEFT JOIN units u ON u.id = i.unit_id
    WHERE p.operating_date = ?
    ORDER BY i.name ASC
  `).all(req.params.date);

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="physical_counts_${req.params.date}.csv"`);
  res.send(csvFromRows(rows));
});

app.get('*', (req, res) => {
  res.sendFile(path.join(publicPath, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`THC Inventory System running on http://localhost:${PORT}`);
});

module.exports = app;
