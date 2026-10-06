/**
 * Express server and API routes
 * Main application server with all endpoints
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
const publicDir = path.join(__dirname, '../public');

// Middleware
app.use(express.json({ limit: '2mb' }));
app.use(express.static(publicDir));

// Validation helpers
function validateQuantity(input, fieldName) {
  const parsed = parseQuantity(input);
  if (parsed === null || Number.isNaN(parsed) || parsed < 0) {
    throw new Error(
      `Invalid ${fieldName}. Please enter a whole number or fraction such as 1/2, 3/4, or 2 1/2.`
    );
  }
  return parsed;
}

function getItemById(itemId) {
  const item = db.prepare(`
    SELECT i.*, c.name as category_name, u.name as unit_name
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

function getPreviousPhysicalEnding(itemId, beforeDate) {
  const row = db.prepare(`
    SELECT quantity
    FROM physical_counts
    WHERE item_id = ? AND operating_date < ?
    ORDER BY operating_date DESC, created_at DESC
    LIMIT 1
  `).get(itemId, beforeDate);

  return row ? Number(row.quantity) : 0;
}

function getDailySummaryForItem(itemId, operatingDate) {
  const item = getItemById(itemId);
  const beginning = getPreviousPhysicalEnding(itemId, operatingDate);

  const production = db.prepare(`
    SELECT COALESCE(SUM(quantity), 0) as total
    FROM production_transactions
    WHERE item_id = ? AND operating_date = ?
  `).get(itemId, operatingDate)?.total || 0;

  const stocksIn = db.prepare(`
    SELECT COALESCE(SUM(quantity), 0) as total
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

  const ending = endingRow ? Number(endingRow.quantity) : 0;

  const snapshot = calculateInventorySnapshot({
    beginning: Number(beginning),
    production: Number(production),
    stocksIn: Number(stocksIn),
    physicalEnding: ending,
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

// Health check
app.get('/api/health', (req, res) => {
  res.json({ ok: true, message: 'THC Inventory System is running' });
});

// ==== CATEGORIES ====
app.get('/api/categories', (req, res) => {
  const rows = db.prepare('SELECT * FROM categories ORDER BY name ASC').all();
  res.json(rows);
});

// ==== UNITS ====
app.get('/api/units', (req, res) => {
  const rows = db.prepare('SELECT * FROM units ORDER BY name ASC').all();
  res.json(rows);
});

// ==== ITEMS (Master Inventory) ====
app.get('/api/items', (req, res) => {
  try {
    const rows = db.prepare(`
      SELECT i.*, c.name as category_name, u.name as unit_name
      FROM items i
      LEFT JOIN categories c ON c.id = i.category_id
      LEFT JOIN units u ON u.id = i.unit_id
      ORDER BY i.name ASC
    `).all();

    res.json(rows.map((row) => ({
      ...row,
      active: !!row.active
    })));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/items/active', (req, res) => {
  try {
    const rows = db.prepare(`
      SELECT i.*, c.name as category_name, u.name as unit_name
      FROM items i
      LEFT JOIN categories c ON c.id = i.category_id
      LEFT JOIN units u ON u.id = i.unit_id
      WHERE i.active = 1
      ORDER BY i.name ASC
    `).all();

    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/items', (req, res) => {
  try {
    const { name, category_id, unit_id, reorder_level, critical_level, target_stock, notes } =
      req.body || {};

    if (!name || !String(name).trim()) {
      return res.status(400).json({ error: 'Item name is required.' });
    }

    if (!category_id) {
      return res.status(400).json({ error: 'Category is required.' });
    }

    if (!unit_id) {
      return res.status(400).json({ error: 'Unit is required.' });
    }

    const itemId = uuid();
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO items (
        id, name, category_id, unit_id, reorder_level, critical_level,
        target_stock, active, notes, source, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      itemId,
      String(name).trim(),
      category_id,
      unit_id,
      Number(reorder_level || 0),
      Number(critical_level || 0),
      Number(target_stock || 0),
      1,
      notes || '',
      'MANUAL',
      now,
      now
    );

    logAudit('items', itemId, 'create', { name, category_id, unit_id });

    const newItem = getItemById(itemId);
    res.status(201).json(newItem);
  } catch (error) {
    res.status(400).json({ error: error.message || 'Unable to create item.' });
  }
});

app.put('/api/items/:id', (req, res) => {
  try {
    const itemId = req.params.id;
    const current = getItemById(itemId);
    const { name, category_id, unit_id, reorder_level, critical_level, target_stock, active, notes } =
      req.body || {};

    const now = new Date().toISOString();

    db.prepare(`
      UPDATE items
      SET name = ?, category_id = ?, unit_id = ?, reorder_level = ?,
          critical_level = ?, target_stock = ?, active = ?, notes = ?, updated_at = ?
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

    logAudit('items', itemId, 'update', {
      name,
      category_id,
      unit_id,
      reorder_level,
      critical_level,
      target_stock,
      active
    });

    const updated = getItemById(itemId);
    res.json(updated);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// ==== PRODUCTION ====
app.get('/api/production', (req, res) => {
  try {
    const date = req.query.date || new Date().toISOString().slice(0, 10);
    const rows = db.prepare(`
      SELECT p.*, i.name as item_name, u.name as unit_name
      FROM production_transactions p
      LEFT JOIN items i ON i.id = p.item_id
      LEFT JOIN units u ON u.id = p.unit_id
      WHERE p.operating_date = ?
      ORDER BY p.created_at DESC
    `).all(date);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/production', (req, res) => {
  try {
    const { item_id, date, quantity, notes } = req.body || {};
    const operatingDate = date || new Date().toISOString().slice(0, 10);
    const parsedQty = validateQuantity(quantity, 'production quantity');

    const item = getItemById(item_id);

    const transactionId = uuid();
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO production_transactions (
        id, item_id, quantity, unit_id, operating_date, source, notes, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      transactionId,
      item.id,
      parsedQty,
      item.unit_id,
      operatingDate,
      'PRODUCTION TEAM',
      notes || '',
      now
    );

    db.prepare(`
      INSERT INTO inventory_transactions (
        id, item_id, transaction_type, operating_date, quantity, unit_id, source, notes, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      uuid(),
      item.id,
      'PRODUCTION',
      operatingDate,
      parsedQty,
      item.unit_id,
      'PRODUCTION TEAM',
      notes || '',
      now
    );

    logAudit('production_transactions', transactionId, 'create', {
      item_id: item.id,
      quantity: parsedQty,
      operating_date: operatingDate
    });

    const production = db.prepare(`
      SELECT p.*, i.name as item_name, u.name as unit_name
      FROM production_transactions p
      LEFT JOIN items i ON i.id = p.item_id
      LEFT JOIN units u ON u.id = p.unit_id
      WHERE p.id = ?
    `).get(transactionId);

    res.status(201).json(production);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// ==== STOCKS IN ====
app.get('/api/stocks-in', (req, res) => {
  try {
    const date = req.query.date || new Date().toISOString().slice(0, 10);
    const rows = db.prepare(`
      SELECT s.*, i.name as item_name, u.name as unit_name
      FROM stock_in_transactions s
      LEFT JOIN items i ON i.id = s.item_id
      LEFT JOIN units u ON u.id = s.unit_id
      WHERE s.operating_date = ?
      ORDER BY s.created_at DESC
    `).all(date);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/stocks-in', (req, res) => {
  try {
    const { item_id, date, quantity, source, reference, notes } = req.body || {};
    const operatingDate = date || new Date().toISOString().slice(0, 10);
    const parsedQty = validateQuantity(quantity, 'stock in quantity');

    const item = getItemById(item_id);

    const transactionId = uuid();
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO stock_in_transactions (
        id, item_id, quantity, unit_id, operating_date, source, reference, notes, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      transactionId,
      item.id,
      parsedQty,
      item.unit_id,
      operatingDate,
      source || 'PURCHASE',
      reference || '',
      notes || '',
      now
    );

    db.prepare(`
      INSERT INTO inventory_transactions (
        id, item_id, transaction_type, operating_date, quantity, unit_id, source, notes, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      uuid(),
      item.id,
      'STOCKS_IN',
      operatingDate,
      parsedQty,
      item.unit_id,
      source || 'PURCHASE',
      notes || '',
      now
    );

    logAudit('stock_in_transactions', transactionId, 'create', {
      item_id: item.id,
      quantity: parsedQty,
      operating_date: operatingDate
    });

    const stockIn = db.prepare(`
      SELECT s.*, i.name as item_name, u.name as unit_name
      FROM stock_in_transactions s
      LEFT JOIN items i ON i.id = s.item_id
      LEFT JOIN units u ON u.id = s.unit_id
      WHERE s.id = ?
    `).get(transactionId);

    res.status(201).json(stockIn);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// ==== PHYSICAL COUNTS ====
app.get('/api/physical-counts', (req, res) => {
  try {
    const date = req.query.date || new Date().toISOString().slice(0, 10);
    const rows = db.prepare(`
      SELECT p.*, i.name as item_name, u.name as unit_name
      FROM physical_counts p
      LEFT JOIN items i ON i.id = p.item_id
      LEFT JOIN units u ON u.id = i.unit_id
      WHERE p.operating_date = ?
      ORDER BY i.name ASC
    `).all(date);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/physical-counts', (req, res) => {
  try {
    const { item_id, date, quantity, notes, shift } = req.body || {};
    const operatingDate = date || new Date().toISOString().slice(0, 10);
    const parsedQty = validateQuantity(quantity, 'physical count quantity');
    const selectedShift = shift || 'NIGHT';

    const item = getItemById(item_id);

    // Check for duplicate
    const existing = db.prepare(`
      SELECT id FROM physical_counts
      WHERE item_id = ? AND operating_date = ? AND shift = ?
    `).get(item.id, operatingDate, selectedShift);

    if (existing) {
      return res.status(409).json({
        error:
          'Duplicate physical count detected for the same date and shift. Please edit the existing count instead.'
      });
    }

    const countId = uuid();
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO physical_counts (
        id, item_id, operating_date, shift, quantity, notes, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(countId, item.id, operatingDate, selectedShift, parsedQty, notes || '', now, now);

    db.prepare(`
      INSERT INTO inventory_transactions (
        id, item_id, transaction_type, operating_date, quantity, unit_id, source, notes, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      uuid(),
      item.id,
      'PHYSICAL_COUNT',
      operatingDate,
      parsedQty,
      item.unit_id,
      'NIGHT OPERATIONS',
      notes || '',
      now
    );

    logAudit('physical_counts', countId, 'create', {
      item_id: item.id,
      operating_date: operatingDate,
      quantity: parsedQty
    });

    const count = db.prepare(`
      SELECT p.*, i.name as item_name, u.name as unit_name
      FROM physical_counts p
      LEFT JOIN items i ON i.id = p.item_id
      LEFT JOIN units u ON u.id = i.unit_id
      WHERE p.id = ?
    `).get(countId);

    res.status(201).json(count);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.put('/api/physical-counts/:id', (req, res) => {
  try {
    const { quantity, notes } = req.body || {};
    const countId = req.params.id;
    const parsedQty = validateQuantity(quantity, 'physical count quantity');
    const now = new Date().toISOString();

    db.prepare(`
      UPDATE physical_counts
      SET quantity = ?, notes = ?, updated_at = ?
      WHERE id = ?
    `).run(parsedQty, notes || '', now, countId);

    logAudit('physical_counts', countId, 'update', { quantity: parsedQty });

    const updated = db.prepare(`
      SELECT p.*, i.name as item_name, u.name as unit_name
      FROM physical_counts p
      LEFT JOIN items i ON i.id = p.item_id
      LEFT JOIN units u ON u.id = i.unit_id
      WHERE p.id = ?
    `).get(countId);

    res.json(updated);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// ==== DASHBOARD ====
app.get('/api/dashboard', (req, res) => {
  try {
    const date = req.query.date || new Date().toISOString().slice(0, 10);

    const items = db.prepare('SELECT * FROM items WHERE active = 1').all();

    let totalItems = 0;
    let outOfStock = 0;
    let criticalLow = 0;
    let lowStock = 0;
    let totalActualUsage = 0;

    const lowStockItems = [];
    const replenishmentItems = [];

    for (const item of items) {
      totalItems += 1;
      const summary = getDailySummaryForItem(item.id, date);

      if (summary.physicalEnding <= 0) outOfStock += 1;
      if (summary.physicalEnding > 0 && summary.physicalEnding <= (item.critical_level || 0)) {
        criticalLow += 1;
      }
      if (summary.physicalEnding > 0 && summary.physicalEnding <= (item.reorder_level || 0)) {
        lowStock += 1;
      }

      totalActualUsage += summary.actualUsage;

      if (summary.physicalEnding <= (item.reorder_level || 0)) {
        lowStockItems.push({
          id: item.id,
          name: item.name,
          quantity: summary.formattedPhysicalEnding,
          unit: item.unit_name,
          status: summary.status,
          recommendation: summary.recommendation
        });
      }

      if (summary.suggestedReplenishment > 0) {
        replenishmentItems.push({
          id: item.id,
          name: item.name,
          currentStock: summary.formattedPhysicalEnding,
          suggestedReplenishment: summary.formattedSuggestedReplenishment,
          unit: item.unit_name,
          status: summary.status
        });
      }
    }

    const productionTotal = db.prepare(`
      SELECT COUNT(*) as count FROM production_transactions WHERE operating_date = ?
    `).get(date).count;

    const stocksInTotal = db.prepare(`
      SELECT COUNT(*) as count FROM stock_in_transactions WHERE operating_date = ?
    `).get(date).count;

    const recentActivity = db.prepare(`
      SELECT 'PRODUCTION' as type, p.operating_date, i.name as item_name, p.quantity, u.name as unit_name, p.source
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
      totalProductionTransactions: productionTotal,
      totalStocksInTransactions: stocksInTotal,
      totalActualUsageToday: formatQuantity(totalActualUsage),
      itemsRequiringReplenishment: replenishmentItems.length,
      lowStockItems,
      replenishmentItems,
      recentActivity
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==== REPORTS ====
app.get('/api/reports/daily', (req, res) => {
  try {
    const date = req.query.date || new Date().toISOString().slice(0, 10);
    const items = db.prepare('SELECT * FROM items WHERE active = 1 ORDER BY name ASC').all();

    const report = items.map((item) => {
      const summary = getDailySummaryForItem(item.id, date);
      return summary;
    });

    res.json(report);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/reports/production', (req, res) => {
  try {
    const date = req.query.date || new Date().toISOString().slice(0, 10);
    const rows = db.prepare(`
      SELECT p.*, i.name as item_name, u.name as unit_name
      FROM production_transactions p
      LEFT JOIN items i ON i.id = p.item_id
      LEFT JOIN units u ON u.id = p.unit_id
      WHERE p.operating_date = ?
      ORDER BY i.name ASC, p.created_at DESC
    `).all(date);

    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/reports/night', (req, res) => {
  try {
    const date = req.query.date || new Date().toISOString().slice(0, 10);
    const counts = db.prepare(`
      SELECT p.*, i.name as item_name, u.name as unit_name
      FROM physical_counts p
      LEFT JOIN items i ON i.id = p.item_id
      LEFT JOIN units u ON u.id = i.unit_id
      WHERE p.operating_date = ?
      ORDER BY i.name ASC
    `).all(date);

    const enriched = counts.map((count) => {
      const summary = getDailySummaryForItem(count.item_id, date);
      return {
        ...count,
        beginning: summary.formattedBeginning,
        production: summary.formattedProduction,
        stocksIn: summary.formattedStocksIn,
        totalAvailable: summary.formattedTotalAvailable,
        actualUsage: summary.formattedActualUsage,
        status: summary.status,
        recommendation: summary.recommendation
      };
    });

    res.json(enriched);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==== ITEM HISTORY ====
app.get('/api/item-history/:id', (req, res) => {
  try {
    const itemId = req.params.id;
    const item = getItemById(itemId);

    const history = db.prepare(`
      SELECT it.*, u.name as unit_name
      FROM inventory_transactions it
      LEFT JOIN units u ON u.id = it.unit_id
      WHERE it.item_id = ?
      ORDER BY it.operating_date DESC, it.created_at DESC
    `).all(itemId);

    res.json({ item, history });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==== EXPORT ====
app.get('/api/export/items', (req, res) => {
  try {
    const rows = db.prepare(`
      SELECT i.id, i.name, c.name as category, u.name as unit,
             i.reorder_level, i.critical_level, i.target_stock,
             i.active, i.created_at, i.updated_at
      FROM items i
      LEFT JOIN categories c ON c.id = i.category_id
      LEFT JOIN units u ON u.id = i.unit_id
      ORDER BY i.name ASC
    `).all();

    const csv = convertToCSV(rows);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="inventory_items.csv"');
    res.send(csv);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/export/production/:date', (req, res) => {
  try {
    const date = req.params.date;
    const rows = db.prepare(`
      SELECT p.id, i.name as item_name, p.quantity, u.name as unit,
             p.operating_date, p.source, p.notes, p.created_at
      FROM production_transactions p
      LEFT JOIN items i ON i.id = p.item_id
      LEFT JOIN units u ON u.id = p.unit_id
      WHERE p.operating_date = ?
      ORDER BY p.created_at DESC
    `).all(date);

    const csv = convertToCSV(rows);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="production_${date}.csv"`);
    res.send(csv);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/export/stocks-in/:date', (req, res) => {
  try {
    const date = req.params.date;
    const rows = db.prepare(`
      SELECT s.id, i.name as item_name, s.quantity, u.name as unit,
             s.operating_date, s.source, s.reference, s.notes, s.created_at
      FROM stock_in_transactions s
      LEFT JOIN items i ON i.id = s.item_id
      LEFT JOIN units u ON u.id = s.unit_id
      WHERE s.operating_date = ?
      ORDER BY s.created_at DESC
    `).all(date);

    const csv = convertToCSV(rows);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="stocks_in_${date}.csv"`);
    res.send(csv);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/export/physical-counts/:date', (req, res) => {
  try {
    const date = req.params.date;
    const rows = db.prepare(`
      SELECT p.id, i.name as item_name, p.quantity, u.name as unit,
             p.operating_date, p.shift, p.notes, p.created_at
      FROM physical_counts p
      LEFT JOIN items i ON i.id = p.item_id
      LEFT JOIN units u ON u.id = i.unit_id
      WHERE p.operating_date = ?
      ORDER BY i.name ASC
    `).all(date);

    const csv = convertToCSV(rows);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="physical_counts_${date}.csv"`);
    res.send(csv);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/export/daily-report/:date', (req, res) => {
  try {
    const date = req.params.date;
    const report = db.prepare(`
      SELECT
        i.name as item_name,
        i.unit_id,
        ? as operating_date
      FROM items i
      WHERE i.active = 1
      ORDER BY i.name ASC
    `).all(date);

    const enriched = report.map((row) => {
      const summary = getDailySummaryForItem(row.item_id || db.prepare('SELECT id FROM items WHERE name = ?').get(row.item_name).id, date);
      return {
        ...row,
        ...summary
      };
    });

    const csv = convertToCSV(enriched);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="daily_report_${date}.csv"`);
    res.send(csv);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

function convertToCSV(data) {
  if (!data || data.length === 0) return '';

  const headers = Object.keys(data[0]);
  const csv = [headers.join(',')];

  for (const row of data) {
    csv.push(headers.map((h) => JSON.stringify(row[h] ?? '')).join(','));
  }

  return csv.join('\n');
}

// ==== AUDIT LOGS ====
app.get('/api/audit-logs', (req, res) => {
  try {
    const logs = db.prepare(`
      SELECT * FROM audit_logs
      ORDER BY created_at DESC
      LIMIT 100
    `).all();
    res.json(logs);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==== STATIC FRONTEND ====
app.get('*', (req, res) => {
  res.sendFile(path.join(publicDir, 'index.html'), (err) => {
    if (err) {
      res.status(404).send('Not found');
    }
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`\n✅ THC Inventory System running on http://localhost:${PORT}\n`);
  console.log('Project repository: https://github.com/weaver555/thc-inventory-system');
});

module.exports = app;
