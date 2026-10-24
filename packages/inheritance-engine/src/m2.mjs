// Separate browser-safe safety API; no legal allocation engine, DOM or network.
export { calculateM2, calculateM2Json, M2_POLICY, M2_VERSION } from './m2/gate.mjs';
export { parseM2InputJson, M2_LIMITS } from './m2/boundary.mjs';
export { InputError } from './fraction.mjs';
export { validateM2TechnicalLedger } from './m2/ledger.mjs';
export { createM2SnapshotAsync, refreshM2SnapshotAsync, createM2Session, SnapshotError } from './m2/snapshot.mjs';
