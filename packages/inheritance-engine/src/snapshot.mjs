// Node-only synchronous adapter. The browser entry never imports this module.
import { createHash } from 'node:crypto';
import { APPROVALS, deepFreeze } from './approval.mjs';
import { calculate } from './engine.mjs';
import { captureDependencies, staleSnapshot } from './snapshot-common.mjs';

export function createSnapshot(input, approvals = APPROVALS) {
  const captured = captureDependencies(input, approvals);
  const dependencyHash = createHash('sha256').update(captured.serialized).digest('hex');
  return deepFreeze({ dependencyHash, result: calculate(captured.input, captured.approvals) });
}
export function refreshSnapshot(snapshot, currentInput, approvals = APPROVALS) {
  if (snapshot.result.status === 'STALE') return snapshot;
  const captured = captureDependencies(currentInput, approvals);
  const currentHash = createHash('sha256').update(captured.serialized).digest('hex');
  return snapshot.dependencyHash === currentHash ? snapshot : staleSnapshot(snapshot);
}
