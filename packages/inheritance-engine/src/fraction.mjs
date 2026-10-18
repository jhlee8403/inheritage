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
  return Object.freeze({ numerator: String(n / divisor), denominator: String(d / divisor) });
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
  a = fraction(a); b = fraction(b);
  return reduced(BigInt(a.numerator) * BigInt(b.denominator) + BigInt(b.numerator) * BigInt(a.denominator),
    BigInt(a.denominator) * BigInt(b.denominator));
}
export function multiply(a, b) {
  a = fraction(a); b = fraction(b);
  return reduced(BigInt(a.numerator) * BigInt(b.numerator), BigInt(a.denominator) * BigInt(b.denominator));
}
export function equal(a, b) {
  a = fraction(a); b = fraction(b);
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
