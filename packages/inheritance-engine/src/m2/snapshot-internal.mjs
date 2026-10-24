import { deepFreeze } from '../approval.mjs';
import { SnapshotError } from '../snapshot-common.mjs';
import { captureM2Object } from './boundary.mjs';
import { calculateM2 } from './gate.mjs';

export function canonicalM2(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalM2).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonicalM2(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

async function digest(text) {
  let subtle, operation;
  try { subtle = globalThis.crypto?.subtle; operation = subtle?.digest; }
  catch (cause) { throw new SnapshotError('HASH_FAILED', cause); }
  if (typeof operation !== 'function') throw new SnapshotError('HASH_UNAVAILABLE');
  try {
    const bytes = await operation.call(subtle, 'SHA-256', new TextEncoder().encode(text));
    if (!(bytes instanceof ArrayBuffer) || bytes.byteLength !== 32) throw new Error('Invalid SHA-256 output');
    return Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2, '0')).join('');
  } catch (cause) { throw new SnapshotError('HASH_FAILED', cause); }
}

// Internal composition seam, NOT a public approval/registry selector. A dependency
// provider affects invalidation only; calculateM2 always uses its fixed PENDING gate.
export function buildM2SnapshotApi(readDependencies) {
  const owned = new WeakSet();
  const staleCopies = new WeakMap();
  const context = () => deepFreeze(captureM2Object(readDependencies()));
  const register = value => { deepFreeze(value); owned.add(value); return value; };
  function check(snapshot) {
    if (!snapshot || snapshot.schemaVersion !== 'm2-snapshot-draft-v1' || !owned.has(snapshot)) {
      throw new SnapshotError('M2_SNAPSHOT_REQUIRED');
    }
  }
  function stale(snapshot) {
    check(snapshot);
    if (snapshot.validity === 'STALE') return snapshot;
    if (staleCopies.has(snapshot)) return staleCopies.get(snapshot);
    const invalidated = register({ ...snapshot, validity: 'STALE', staleReasons: ['DEPENDENCIES_CHANGED'],
      result: { ...snapshot.result, status: 'STALE',
        warnings: [...snapshot.result.warnings, 'STALE_RESULT_DO_NOT_USE'] } });
    staleCopies.set(snapshot, invalidated);
    return invalidated;
  }
  function capture(input) {
    // All validation, copying, calculation and dependency serialization precede await.
    const capturedInput = captureM2Object(input), dependencies = context();
    const result = calculateM2(capturedInput);
    const payload = deepFreeze({ input: capturedInput, dependencies });
    return { payload, result, serialized: canonicalM2(payload), contextKey: canonicalM2(dependencies) };
  }
  async function createM2SnapshotAsync(input) {
    if (arguments.length !== 1) throw new SnapshotError('APPROVAL_OVERRIDE_FORBIDDEN');
    const captured = capture(input);
    const dependencyHash = await digest(captured.serialized);
    const snapshot = register({ schemaVersion: 'm2-snapshot-draft-v1', validity: 'CURRENT',
      dependencyHash, inputRevision: captured.payload.input.inputRevision,
      approvalContextRevision: captured.contextKey, dependencies: captured.payload.dependencies,
      result: captured.result });
    return captured.contextKey === canonicalM2(context()) ? snapshot : stale(snapshot);
  }
  async function refreshM2SnapshotAsync(snapshot, input) {
    if (arguments.length !== 2) throw new SnapshotError('APPROVAL_OVERRIDE_FORBIDDEN');
    check(snapshot);
    if (snapshot.validity === 'STALE') return snapshot;
    if (staleCopies.has(snapshot)) return staleCopies.get(snapshot);
    const captured = capture(input);
    const hash = await digest(captured.serialized);
    if (staleCopies.has(snapshot)) return staleCopies.get(snapshot);
    return hash === snapshot.dependencyHash && captured.contextKey === canonicalM2(context()) ? snapshot : stale(snapshot);
  }
  function createM2Session() {
    if (arguments.length) throw new SnapshotError('APPROVAL_OVERRIDE_FORBIDDEN');
    let epoch = 0, input = null, state = deepFreeze({ status: 'EMPTY', revision: 0, snapshot: null, previousSnapshot: null, error: null });
    const set = (status, snapshot = null, previousSnapshot = state.previousSnapshot, error = null) => {
      state = deepFreeze({ status, revision: epoch, snapshot, previousSnapshot, error });
    };
    function invalidate(status = 'STALE') {
      epoch++;
      const previous = state.snapshot ? stale(state.snapshot) : state.previousSnapshot;
      set(status, null, previous);
    }
    function setInput(value) {
      if (arguments.length !== 1) throw new SnapshotError('APPROVAL_OVERRIDE_FORBIDDEN');
      invalidate(); input = null;
      try { input = deepFreeze(capture(value).payload.input); }
      catch (error) { set('ERROR', null, state.previousSnapshot, { code: error.code, field: error.field ?? null }); throw error; }
      return state;
    }
    async function run() {
      const request = ++epoch;
      const previous = state.snapshot ? stale(state.snapshot) : state.previousSnapshot;
      set('RUNNING', null, previous);
      try {
        const snapshot = await createM2SnapshotAsync(input);
        if (request !== epoch) return { published: false };
        if (snapshot.validity === 'STALE' || canonicalM2(snapshot.dependencies) !== canonicalM2(context())) {
          set('STALE', null, stale(snapshot)); return { published: false };
        }
        set(snapshot.result.status, snapshot);
        return { published: true, snapshot };
      } catch (error) {
        if (request !== epoch) return { published: false };
        set('ERROR', null, state.previousSnapshot, { code: error.code ?? 'CALCULATION_FAILED', field: error.field ?? null });
        return { published: false, error: state.error };
      }
    }
    function getState() {
      // Recheck trusted runtime dependencies even when callers omit change notification.
      if (state.snapshot && (staleCopies.has(state.snapshot) || canonicalM2(state.snapshot.dependencies) !== canonicalM2(context()))) invalidate();
      return state;
    }
    return Object.freeze({ setInput, run, getState, cancel: () => invalidate('CANCELLED'), invalidateDependencies: () => invalidate() });
  }
  return Object.freeze({ createM2SnapshotAsync, refreshM2SnapshotAsync, createM2Session });
}
