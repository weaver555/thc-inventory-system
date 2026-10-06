/**
 * Inventory calculation engine
 * Central logic for all inventory calculations
 * Ensures consistent calculations across the entire application
 */

const { formatQuantity } = require('../utils/fraction');

function calculateInventorySnapshot({
  beginning = 0,
  production = 0,
  stocksIn = 0,
  physicalEnding = 0,
  item = {}
}) {
  const b = Number(beginning) || 0;
  const p = Number(production) || 0;
  const s = Number(stocksIn) || 0;
  const e = Number(physicalEnding) || 0;

  const totalAvailable = b + p + s;
  const actualUsage = totalAvailable - e;

  // Determine status
  let status = 'OK';
  let recommendation = 'NO ACTION';
  let flag = null;

  // Check if ending exceeds available
  if (e > totalAvailable) {
    status = 'CHECK COUNT';
    recommendation = 'ENDING STOCK EXCEEDS AVAILABLE STOCK';
    flag = 'CHECK COUNT — ENDING STOCK EXCEEDS AVAILABLE STOCK';
  } else if (e <= 0) {
    status = 'OUT OF STOCK';
    recommendation = 'REPLENISH IMMEDIATELY';
  } else {
    const criticalLevel = Number(item.critical_level) || 0;
    const reorderLevel = Number(item.reorder_level) || 0;

    if (criticalLevel > 0 && e <= criticalLevel) {
      status = 'CRITICAL LOW';
      recommendation = 'REPLENISH IMMEDIATELY';
    } else if (reorderLevel > 0 && e <= reorderLevel) {
      status = 'LOW STOCK';
      recommendation = 'REPLENISH SOON';
    }
  }

  // Calculate suggested replenishment
  const targetStock = Number(item.target_stock) || 0;
  const suggestedReplenishment = Math.max(0, targetStock - e);

  return {
    beginning: b,
    production: p,
    stocksIn: s,
    totalAvailable,
    physicalEnding: e,
    actualUsage,
    status,
    recommendation,
    suggestedReplenishment,
    flag,
    // Formatted versions for display
    formattedBeginning: formatQuantity(b),
    formattedProduction: formatQuantity(p),
    formattedStocksIn: formatQuantity(s),
    formattedTotalAvailable: formatQuantity(totalAvailable),
    formattedPhysicalEnding: formatQuantity(e),
    formattedActualUsage: formatQuantity(actualUsage),
    formattedSuggestedReplenishment: formatQuantity(suggestedReplenishment)
  };
}

module.exports = {
  calculateInventorySnapshot
};
