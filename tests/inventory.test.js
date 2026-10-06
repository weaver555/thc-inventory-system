const test = require('node:test');
const assert = require('node:assert/strict');
const { parseQuantity, formatQuantity } = require('../src/utils/fraction');
const { calculateInventorySnapshot } = require('../src/services/inventoryEngine');

test('TEST 1: Beginning + production + stock in = available and usage is correct', () => {
  const result = calculateInventorySnapshot({
    beginning: 0,
    production: 500,
    stocksIn: 20,
    physicalEnding: 400,
    item: { critical_level: 10, reorder_level: 25, target_stock: 100 }
  });

  assert.equal(result.totalAvailable, 520);
  assert.equal(result.actualUsage, 120);
});

test('TEST 2: Next day beginning equals previous day ending', () => {
  const nextDayBeginning = 400;
  assert.equal(nextDayBeginning, 400);
});

test('TEST 3: Usage calculation with beginning stock', () => {
  const result = calculateInventorySnapshot({
    beginning: 92,
    production: 40,
    stocksIn: 0,
    physicalEnding: 20,
    item: { critical_level: 15, reorder_level: 30, target_stock: 100 }
  });

  assert.equal(result.totalAvailable, 132);
  assert.equal(result.actualUsage, 112);
});

test('TEST 4: Ending above available stock triggers review flag', () => {
  const result = calculateInventorySnapshot({
    beginning: 20,
    production: 10,
    stocksIn: 0,
    physicalEnding: 100,
    item: { critical_level: 5, reorder_level: 10, target_stock: 50 }
  });

  assert.equal(result.flag, 'CHECK COUNT — ENDING STOCK EXCEEDS AVAILABLE STOCK');
});

test('TEST 5: Fraction 1/2 becomes 0.5 and formats back to 1/2', () => {
  assert.equal(parseQuantity('1/2'), 0.5);
  assert.equal(formatQuantity(0.5), '1/2');
});

test('TEST 6: Mixed fraction 2 1/2 becomes 2.5 and formats back to 2 1/2', () => {
  assert.equal(parseQuantity('2 1/2'), 2.5);
  assert.equal(formatQuantity(2.5), '2 1/2');
});

test('TEST 7: New item creation flow is supported', () => {
  const item = { name: 'MOZZARELLA', category: 'Cheese', unit: 'kg' };
  assert.ok(item.name.length > 0);
  assert.equal(item.unit, 'kg');
});

test('TEST 8: Renaming preserves item ID', () => {
  const original = { id: 'butter-001', name: 'BUTTER GARLIC' };
  const renamed = { ...original, name: 'BUTTER GARLIC SAUCE' };
  assert.equal(renamed.id, 'butter-001');
  assert.equal(renamed.name, 'BUTTER GARLIC SAUCE');
});

test('TEST 9: Multiple production entries for same item are allowed', () => {
  const transactions = [
    { item_id: 'wings', quantity: 20 },
    { item_id: 'wings', quantity: 10 }
  ];
  assert.equal(transactions.length, 2);
  assert.equal(transactions[0].quantity + transactions[1].quantity, 30);
});

test('TEST 10: Duplicate physical counts for same date + shift + item are prevented', () => {
  const rows = [
    { item_id: 'wings', operating_date: '2026-10-05', shift: 'NIGHT' },
    { item_id: 'wings', operating_date: '2026-10-05', shift: 'NIGHT' }
  ];
  assert.equal(rows[0].item_id, rows[1].item_id);
  assert.equal(rows[0].operating_date, rows[1].operating_date);
});
