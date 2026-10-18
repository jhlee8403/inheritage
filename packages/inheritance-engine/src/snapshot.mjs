import { createHash } from 'node:crypto';
import { APPROVALS, deepFreeze } from './approval.mjs';
import { calculate } from './engine.mjs';

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${canonical(value[k])}`).join(',')}}`;
  }
  const serialized = JSON.stringify(value);
  if (serialized === undefined) throw new TypeError('Snapshot dependencies must be JSON values');
  return serialized;
}
function fingerprint(input, approvals) {
  return createHash('sha256').update(canonical({ engineVersion: '0.1.0', input, approvals })).digest('hex');
}
export function createSnapshot(input, approvals = APPROVALS) {
  return deepFreeze({ dependencyHash: fingerprint(input, approvals), result: calculate(input, approvals) });
}
export function refreshSnapshot(snapshot, currentInput, approvals = APPROVALS) {
  if (snapshot.result.status === 'STALE' || snapshot.dependencyHash === fingerprint(currentInput, approvals)) return snapshot;
  return deepFreeze({ ...structuredClone(snapshot), result: { ...structuredClone(snapshot.result), status: 'STALE',
    staleReasons: ['DEPENDENCIES_CHANGED'], warnings: [...snapshot.result.warnings, 'STALE_RESULT_DO_NOT_USE'] } });
}
