// Scales free-text ingredient quantities like "2 cups", "1 1/2 tsp", "1/2 lb".

const COMMON_FRACTIONS: [number, string][] = [
  [1 / 8, '1/8'],
  [1 / 4, '1/4'],
  [1 / 3, '1/3'],
  [3 / 8, '3/8'],
  [1 / 2, '1/2'],
  [5 / 8, '5/8'],
  [2 / 3, '2/3'],
  [3 / 4, '3/4'],
  [7 / 8, '7/8'],
];

/** Formats a number using common cooking fractions where close enough. */
const formatQuantityNumber = (value: number): string => {
  if (!isFinite(value)) return '';
  const rounded = Math.round(value * 1000) / 1000;
  const whole = Math.floor(rounded);
  const frac = rounded - whole;

  if (frac < 0.02) return String(whole);

  let fracLabel = '';
  let best = 0.03;
  for (const [val, label] of COMMON_FRACTIONS) {
    const diff = Math.abs(frac - val);
    if (diff < best) {
      best = diff;
      fracLabel = label;
    }
  }

  if (fracLabel) return whole > 0 ? `${whole} ${fracLabel}` : fracLabel;
  // No close fraction — fall back to a trimmed decimal.
  return String(Math.round(rounded * 100) / 100);
};

/**
 * Multiplies the leading amount in a quantity string by `factor`, preserving
 * the unit/remainder. Handles integers, decimals, fractions ("1/2"), and mixed
 * numbers ("1 1/2"). Returns the string unchanged when it has no leading number.
 */
export const scaleQuantity = (quantity: string, factor: number): string => {
  if (!quantity || factor === 1) return quantity;

  // Mixed number: "1 1/2 cups"
  const mixed = quantity.match(/^\s*(\d+)\s+(\d+)\/(\d+)\s*(.*)$/);
  if (mixed) {
    const value = (parseInt(mixed[1], 10) + parseInt(mixed[2], 10) / parseInt(mixed[3], 10)) * factor;
    return `${formatQuantityNumber(value)}${mixed[4] ? ' ' + mixed[4] : ''}`;
  }

  // Simple fraction: "1/2 tsp"
  const frac = quantity.match(/^\s*(\d+)\/(\d+)\s*(.*)$/);
  if (frac) {
    const value = (parseInt(frac[1], 10) / parseInt(frac[2], 10)) * factor;
    return `${formatQuantityNumber(value)}${frac[3] ? ' ' + frac[3] : ''}`;
  }

  // Integer or decimal: "2 cups", "1.5 lb"
  const num = quantity.match(/^\s*(\d+(?:\.\d+)?)\s*(.*)$/);
  if (num) {
    const value = parseFloat(num[1]) * factor;
    return `${formatQuantityNumber(value)}${num[2] ? ' ' + num[2] : ''}`;
  }

  // No leading number (e.g. "to taste", "a pinch") — leave unchanged.
  return quantity;
};

export const SCALE_FACTORS: { value: number; label: string }[] = [
  { value: 0.5, label: '½×' },
  { value: 1, label: '1×' },
  { value: 2, label: '2×' },
  { value: 3, label: '3×' },
];
