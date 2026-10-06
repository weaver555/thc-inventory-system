/**
 * Central inventory calculation engine.
 * All dashboard/report calculations should use this logic.
 */

const { formatQuantity } = require('./fraction');

function calculateInventorySnapshot({
  beginning = 0,
  production = 0,
  stocksIn = 0,
  physicalEnding = 0,
  item = {}
}) {
  const begin = Number(beginning) || 0;
  const prod = Number(production) || 0;
  const stockIn = Number(stocksIn) || 0;
  const ending = Number(physicalEnding) || 0;

  const totalAvailable = begin + prod + stockIn;
  const actualUsage = totalAvailable - ending;

  let status = 'OK';
  let recommendation = 'NO ACTION';
  let flag = null;

  if (ending > totalAvailable) {
    status = 'CHECK COUNT';
    recommendation = 'ENDING STOCK EXCEEDS AVAILABLE STOCK';
    flag = 'CHECK COUNT — ENDING STOCK EXCEEDS AVAILABLE STOCK';
  } else if (ending <= 0) {
    status = 'OUT OF STOCK';
    recommendation = 'REPLENISH IMMEDIATELY';
  } else {
    const criticalLevel = Number(item.critical_level || 0);
    const reorderLevel = Number(item.reorder_level || 0);
    if (criticalLevel > 0 && ending <= criticalLevel) {
      status = 'CRITICAL LOW';
      recommendation = 'REPLENISH IMMEDIATELY';
    } else if (reorderLevel > 0 && ending <= reorderLevel) {
      status = 'LOW STOCK';
      recommendation = 'REPLENISH SOON';
    }
  }

  const targetStock = Number(item.target_stock || 0);
  const suggestedReplenishment = Math.max(0, targetStock - ending);

  return {
    beginning: begin,
    production: prod,
    stocksIn: stockIn,
    totalAvailable,
    physicalEnding: ending,
    actualUsage,
    status,
    recommendation,
    suggestedReplenishment,
    flag,
    formattedBeginning: formatQuantity(begin),
    formattedProduction: formatQuantity(prod),
    formattedStocksIn: formatQuantity(stockIn),
    formattedTotalAvailable: formatQuantity(totalAvailable),
    formattedPhysicalEnding: formatQuantity(ending),
    formattedActualUsage: formatQuantity(actualUsage),
    formattedSuggestedReplenishment: formatQuantity(suggestedReplenishment)
  };
}

module.exports = {
  calculateInventorySnapshot
};
