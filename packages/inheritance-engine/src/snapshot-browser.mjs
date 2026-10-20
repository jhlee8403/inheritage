import { APPROVALS, deepFreeze } from './approval.mjs';
import { calculate } from './engine.mjs';
import { captureDependencies, staleSnapshot, SnapshotError } from './snapshot-common.mjs';

async function digest(serialized) {
  const subtle = globalThis.crypto?.subtle;
  if (typeof subtle?.digest !== 'function') throw new SnapshotError('HASH_UNAVAILABLE');
  try {
    const bytes = new TextEncoder().encode(serialized);
    const hash = await subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(hash), b => b.toString(16).padStart(2,'0')).join('');
  } catch (cause) { throw new SnapshotError('HASH_FAILED', cause); }
}
export async function createSnapshotAsync(input, approvals = APPROVALS) {
  const captured = captureDependencies(input, approvals);
  const dependencyHash = await digest(captured.serialized);
  return deepFreeze({ dependencyHash, result: calculate(captured.input, captured.approvals) });
}
export async function refreshSnapshotAsync(snapshot, currentInput, approvals = APPROVALS) {
  if (snapshot.result.status === 'STALE') return snapshot;
  const captured = captureDependencies(currentInput, approvals);
  const currentHash = await digest(captured.serialized);
  return snapshot.dependencyHash === currentHash ? snapshot : staleSnapshot(snapshot);
}
