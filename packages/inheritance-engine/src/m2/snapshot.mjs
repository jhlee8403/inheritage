import { APPROVALS } from '../approval.mjs';
import { ENGINE_VERSION } from '../version.mjs';
import { M2_POLICY, M2_VERSION } from './gate.mjs';
import { buildM2SnapshotApi } from './snapshot-internal.mjs';

// Fixed engine-owned dependencies. No caller-supplied approval parameter.
const api = buildM2SnapshotApi(() => ({
  snapshotVersion: 'm2-snapshot-safety-v1', schemaVersion: 'm2-input-draft-v1',
  resultSchemaVersion: 'm2-result-draft-v1', contractVersion: 'M2-contract-draft-v1',
  engineVersion: M2_VERSION, c1EngineVersion: ENGINE_VERSION,
  m2Policy: M2_POLICY, c1ApprovalRecord: APPROVALS,
}));
export const { createM2SnapshotAsync, refreshM2SnapshotAsync, createM2Session } = api;
export { SnapshotError } from '../snapshot-common.mjs';
