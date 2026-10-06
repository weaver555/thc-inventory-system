/**
 * Fraction parsing and formatting utility
 * Converts between fractions (1/2, 2 1/2) and decimals (0.5, 2.5)
 */

function parseQuantity(input) {
  if (input === null || input === undefined || input === '') {
    return null;
  }

  const str = String(input).trim();
  if (!str) return null;

  // Try parsing as decimal first
  const decimal = parseFloat(str);
  if (!Number.isNaN(decimal)) {
    return decimal;
  }

  // Try parsing as mixed number like "2 1/2"
  const mixedMatch = str.match(/^(\d+)\s+(\d+)\/(\d+)$/);
  if (mixedMatch) {
    const whole = parseInt(mixedMatch[1], 10);
    const numerator = parseInt(mixedMatch[2], 10);
    const denominator = parseInt(mixedMatch[3], 10);
    if (denominator === 0) return null;
    return whole + numerator / denominator;
  }

  // Try parsing as simple fraction like "1/2"
  const fractionMatch = str.match(/^(\d+)\/(\d+)$/);
  if (fractionMatch) {
    const numerator = parseInt(fractionMatch[1], 10);
    const denominator = parseInt(fractionMatch[2], 10);
    if (denominator === 0) return null;
    return numerator / denominator;
  }

  return null;
}

function formatQuantity(value) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return '0';
  }

  const num = Number(value);
  if (!Number.isFinite(num)) return '0';

  // If it's a whole number
  if (Number.isInteger(num)) {
    return String(num);
  }

  // Common fractions
  const fractionMap = {
    0.5: '1/2',
    0.25: '1/4',
    0.75: '3/4',
    0.125: '1/8',
    0.333333: '1/3',
    0.666667: '2/3'
  };

  // Check for exact match with common fractions
  for (const [decimal, fraction] of Object.entries(fractionMap)) {
    if (Math.abs(num - parseFloat(decimal)) < 0.00001) {
      return fraction;
    }
  }

  // Check for mixed numbers (whole + fraction)
  const whole = Math.floor(num);
  const fractional = num - whole;

  for (const [decimal, fraction] of Object.entries(fractionMap)) {
    if (Math.abs(fractional - parseFloat(decimal)) < 0.00001) {
      if (whole > 0) {
        return `${whole} ${fraction}`;
      }
      return fraction;
    }
  }

  // Fall back to decimal with up to 2 decimal places
  return num.toFixed(2).replace(/\.?0+$/, '');
}

module.exports = {
  parseQuantity,
  formatQuantity
};
