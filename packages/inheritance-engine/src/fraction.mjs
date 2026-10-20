// Decimal strings at the boundary, BigInt throughout; no Number conversion of shares.
export class InputError extends Error {
  constructor(code, field) {
    super(`${code}: ${field}`);
    this.name = 'InputError';
    this.code = code;
    this.field = field;
  }
}

const MAX_DIGITS = 1024;
// Only this module can mint trusted internal values. Properties/prototypes/JSON cannot forge this brand.
const internalValues = new WeakSet();
const operand = value => internalValues.has(value) ? value : fraction(value);

// Keep validated immutable fractions when copying engine results, without trusting fresh external objects.
export function cloneExactValue(value) {
  if (internalValues.has(value)) return value;
  if (Array.isArray(value)) return value.map(cloneExactValue);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key,item]) => [key,cloneExactValue(item)]));
  }
  return value;
}
function integer(value, field) {
  if (typeof value !== 'string' || !/^-?\d+$/.test(value) || value.length > MAX_DIGITS) {
    throw new InputError('INVALID_INTEGER_STRING', field);
  }
  return BigInt(value);
}
function gcd(a, b) {
  while (b !== 0n) [a, b] = [b, a % b];
  return a;
}
function reduced(n, d) {
  if (d <= 0n) throw new InputError('NONPOSITIVE_DENOMINATOR', 'fraction.denominator');
  if (n < 0n) throw new InputError('NEGATIVE_SHARE', 'fraction.numerator');
  const divisor = gcd(n, d);
  const value = Object.freeze({ numerator: String(n / divisor), denominator: String(d / divisor) });
  internalValues.add(value);
  return value;
}
export function fraction(value, field = 'fraction') {
  if (!value || typeof value !== 'object') throw new InputError('INVALID_FRACTION', field);
  const n = integer(value.numerator, `${field}.numerator`);
  const d = integer(value.denominator, `${field}.denominator`);
  return reduced(n, d);
}
export const ZERO = reduced(0n, 1n);
export const ONE = reduced(1n, 1n);
export function ratio(n, d) { return reduced(n, d); }
export function add(a, b) {
  a = operand(a); b = operand(b);
  return reduced(BigInt(a.numerator) * BigInt(b.denominator) + BigInt(b.numerator) * BigInt(a.denominator),
    BigInt(a.denominator) * BigInt(b.denominator));
}
export function multiply(a, b) {
  a = operand(a); b = operand(b);
  return reduced(BigInt(a.numerator) * BigInt(b.numerator), BigInt(a.denominator) * BigInt(b.denominator));
}
export function equal(a, b) {
  a = operand(a); b = operand(b);
  return a.numerator === b.numerator && a.denominator === b.denominator;
}
export function sum(values) { return values.reduce(add, ZERO); }
export function initialShare(value) {
  const q = fraction(value, 'asset.share');
  if (BigInt(q.numerator) <= 0n || BigInt(q.numerator) > BigInt(q.denominator)) {
    throw new InputError('INITIAL_SHARE_OUT_OF_RANGE', 'asset.share');
  }
  return q;
}
