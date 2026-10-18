import { InputError, ZERO, equal, sum } from './fraction.mjs';

export function validateConservation(result) {
  const allocated = sum(result.allocations.map(a => a.wholeShare));
  const unresolved = sum(result.unresolved.map(a => a.wholeShare));
  const total = sum([allocated, unresolved]);
  return { ok: equal(total, result.initialShare), allocated, unresolved, total, expected: result.initialShare };
}

// Structural identity/path checks are independent of the total-share check.
// Truth tests separately compare the expected people, routes and legal rule IDs.
export function validateIdentityPaths(result) {
  const issues = [];
  const seen = new Set();
  const people = new Set();
  for (const path of result.paths) {
    if (seen.has(path.pathId)) issues.push('DUPLICATE_PATH');
    seen.add(path.pathId);
    if (path.eventId !== result.eventId) issues.push('PATH_EVENT_MISMATCH');
  }
  for (const a of result.allocations) {
    if (people.has(a.personId)) issues.push('DUPLICATE_PERSON');
    people.add(a.personId);
    const paths = result.paths.filter(p => a.pathIds.includes(p.pathId));
    if (new Set(a.pathIds).size !== a.pathIds.length || paths.length !== a.pathIds.length || !paths.length) {
      issues.push('INVALID_PATH_REFERENCE');
    }
    if (paths.some(p => p.toId !== a.personId)) issues.push('PATH_PERSON_MISMATCH');
    if (!equal(sum(paths.map(p => p.wholeShare)), a.wholeShare)) issues.push('PATH_WHOLE_SHARE_MISMATCH');
    if (!equal(sum(paths.map(p => p.relativeShare)), a.relativeShare)) issues.push('PATH_RELATIVE_SHARE_MISMATCH');
  }
  for (const p of result.paths) {
    if (result.allocations.filter(a => a.pathIds.includes(p.pathId)).length !== 1) issues.push('ORPHAN_OR_SHARED_PATH');
  }
  if (result.nonSelected.some(p => people.has(p.personId) || !equal(p.wholeShare, ZERO))) issues.push('NONSELECTED_CONFLICT');
  return { ok: issues.length === 0, issues: [...new Set(issues)] };
}
export function assertIntegrity(result) {
  const checks = { conservation: validateConservation(result), identityPaths: validateIdentityPaths(result) };
  if (!checks.conservation.ok || !checks.identityPaths.ok) throw new InputError('RESULT_INTEGRITY_ERROR', 'result');
  return checks;
}
