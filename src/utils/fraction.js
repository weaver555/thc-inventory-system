/**
 * Fraction parser and formatter
 * Accepts restaurant-friendly quantities such as 1/2, 1/4, 2 1/2, and decimals.
 */

function parseQuantity(input) {
  if (input === null || input === undefined || input === '') return null;

  const raw = String(input).trim();
  if (!raw) return null;

  const asNumber = Number(raw);
  if (!Number.isNaN(asNumber)) {
    return asNumber;
  }

  const mixed = raw.match(/^(\d+)\s+(\d+)\/(\d+)$/);
  if (mixed) {
    const whole = Number(mixed[1]);
    const numerator = Number(mixed[2]);
    const denominator = Number(mixed[3]);
    if (denominator === 0) return null;
    return whole + (numerator / denominator);
  }

  const simple = raw.match(/^(\d+)\/(\d+)$/);
  if (simple) {
    const numerator = Number(simple[1]);
    const denominator = Number(simple[2]);
    if (denominator === 0) return null;
    return numerator / denominator;
  }

  return null;
}

function formatQuantity(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return '0';
  }

  const num = Number(value);
  if (!Number.isFinite(num)) return '0';

  // Whole number
  if (Number.isInteger(num)) {
    return String(num);
  }

  const commonFractions = [
    { value: 0.125, text: '1/8' },
    { value: 0.25, text: '1/4' },
    { value: 0.3333333333, text: '1/3' },
    { value: 0.5, text: '1/2' },
    { value: 0.6666666667, text: '2/3' },
    { value: 0.75, text: '3/4' }
  ];

  const whole = Math.floor(num);
  const fractional = num - whole;

  for (const entry of commonFractions) {
    if (Math.abs(fractional - entry.value) < 0.0001) {
      const text = whole > 0 ? `${whole} ${entry.text}` : entry.text;
      return text;
    }
  }

  // Decimal fallback
  const rounded = Number(num.toFixed(2));
  return String(rounded);
}

module.exports = {
  parseQuantity,
  formatQuantity
};
