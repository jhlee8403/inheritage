import { deepFreeze } from './approval.mjs';
import { cloneExactValue } from './fraction.mjs';
import { ENGINE_VERSION } from './version.mjs';

export class SnapshotError extends Error {
  constructor(code, cause) {
    super(code, { cause }); this.name = 'SnapshotError'; this.code = code;
  }
}
function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    const proto = Object.getPrototypeOf(value);
    if (proto !== Object.prototype && proto !== null) throw new SnapshotError('NON_JSON_DEPENDENCY');
    return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${canonical(value[k])}`).join(',')}}`;
  }
  if (typeof value === 'number' && !Number.isFinite(value)) throw new SnapshotError('NON_JSON_DEPENDENCY');
  const serialized = JSON.stringify(value);
  if (serialized === undefined) throw new SnapshotError('NON_JSON_DEPENDENCY');
  return serialized;
}
// Clone synchronously before any await. Hashing and calculation use these same private copies.
export function captureDependencies(input, approvals) {
  const copies = structuredClone({ engineVersion: ENGINE_VERSION, input, approvals });
  return { ...copies, serialized: canonical(copies) };
}
export function staleSnapshot(snapshot) {
  return deepFreeze({ ...cloneExactValue(snapshot), result: { ...cloneExactValue(snapshot.result), status: 'STALE',
    staleReasons: ['DEPENDENCIES_CHANGED'], warnings: [...snapshot.result.warnings, 'STALE_RESULT_DO_NOT_USE'] } });
}
