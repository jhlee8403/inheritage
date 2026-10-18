import { InputError, ONE, initialShare, fraction, multiply, sum, equal } from './fraction.mjs';
import { deepFreeze } from './approval.mjs';

// Pure arithmetic only. This API does not choose heirs, event order, or legal capacities.
// It is not an input path into calculate(), and has no REVIEW_READY legal result.
export function evaluateArithmeticPaths({ initial, paths, truthReference = null }) {
  if (truthReference !== null && (truthReference.id !== 'BL1-T07' || truthReference.version !== 'v1')) {
    throw new InputError('ARITHMETIC_TRUTH_UNSUPPORTED', 'truthReference');
  }
  const q = initialShare(initial);
  if (!Array.isArray(paths) || !paths.length) throw new InputError('MISSING_PATHS', 'paths');
  const seen = new Set();
  const normalized = paths.map(path => {
    if (typeof path.pathId !== 'string' || !path.pathId || typeof path.personId !== 'string' || !path.personId) {
      throw new InputError('INVALID_PATH_IDENTITY', 'paths');
    }
    if (seen.has(path.pathId)) throw new InputError('DUPLICATE_PATH', path.pathId);
    seen.add(path.pathId);
    if (!Array.isArray(path.factors) || !path.factors.length) throw new InputError('MISSING_FACTORS', path.pathId);
    const factors = path.factors.map(f => {
      const value = fraction(f);
      if (BigInt(value.numerator) > BigInt(value.denominator)) throw new InputError('FACTOR_OUT_OF_RANGE', path.pathId);
      return value;
    });
    const relativeShare = factors.reduce(multiply, ONE);
    return { pathId: path.pathId, personId: path.personId, factors, relativeShare, wholeShare: multiply(q, relativeShare) };
  });
  const people = [...new Set(normalized.map(p => p.personId))];
  const allocations = people.map(personId => {
    const own = normalized.filter(p => p.personId === personId);
    return { personId, pathIds: own.map(p => p.pathId),
      relativeShare: sum(own.map(p => p.relativeShare)), wholeShare: sum(own.map(p => p.wholeShare)) };
  });
  if (!equal(sum(normalized.map(p => p.relativeShare)), ONE) || !equal(sum(allocations.map(p => p.wholeShare)), q)) {
    throw new InputError('ARITHMETIC_CONSERVATION_ERROR', 'paths');
  }
  return deepFreeze({ status: 'ARITHMETIC_ONLY', warnings: ['NO_LEGAL_CAPACITY_DETERMINATION'],
    initialShare: q, paths: normalized, allocations, unresolved: [], blockedReasons: [],
    provenance: { appliedRules: [{ id: 'BL1-R06', version: 'v1' }, { id: 'BL1-R07', version: 'v1' }],
      truthReference: structuredClone(truthReference), truthVersion: truthReference?.version ?? null,
      eventId: null, lawSnapshotId: null, lawApplicability: 'NOT_APPLICABLE_ARITHMETIC_ONLY' } });
}
