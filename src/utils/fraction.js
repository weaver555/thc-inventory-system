const { parseQuantity, formatQuantity } = require('./fraction');

function parseFractionValue(input) {
  return parseQuantity(input);
}

function isNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

function calculateDailySnapshot({ itemId, item, operatingDate, productionQty, stockInQty, physicalEnding, previousEnding }) {
  const beginning = Number(previousEnding || 0);
  const production = Number(productionQty || 0);
  const stocksIn = Number(stockInQty || 0);
  const totalAvailable = beginning + production + stocksIn;
  const ending = Number(physicalEnding || 0);
  const usage = totalAvailable - ending;
  let status = 'OK';
  let recommendation = 'NO ACTION';

  if (ending > totalAvailable) {
    status = 'CHECK COUNT';
    recommendation = 'ENDING STOCK EXCEEDS AVAILABLE STOCK';
  } else if (ending <= 0) {
    status = 'OUT OF STOCK';
    recommendation = 'REPLENISH IMMEDIATELY';
  } else if (item && item.critical_level != null && ending <= Number(item.critical_level)) {
    status = 'CRITICAL LOW';
    recommendation = 'REPLENISH IMMEDIATELY';
  } else if (item && item.reorder_level != null && ending <= Number(item.reorder_level)) {
    status = 'LOW STOCK';
    recommendation = 'REPLENISH SOON';
  }

  const targetStock = item && item.target_stock != null ? Number(item.target_stock) : 0;
  const suggestedReplenishment = Math.max(0, targetStock - ending);

  return {
    beginning,
    production,
    stocksIn,
    totalAvailable,
    physicalEnding: ending,
    actualUsage: usage,
    status,
    recommendation,
    suggestedReplenishment,
    formattedBeginning: formatQuantity(beginning),
    formattedProduction: formatQuantity(production),
    formattedStocksIn: formatQuantity(stocksIn),
    formattedEnding: formatQuantity(ending),
    formattedUsage: formatQuantity(usage),
    formattedReplenishment: formatQuantity(suggestedReplenishment),
    flag: ending > totalAvailable ? 'CHECK COUNT — ENDING STOCK EXCEEDS AVAILABLE STOCK' : null
  };
}

module.exports = {
  parseFractionValue,
  calculateDailySnapshot,
  formatQuantity,
  isNumber
};
