import * as api from '../../src/m2.mjs';
import { buildM2SnapshotApi, canonicalM2 } from '../../src/m2/snapshot-internal.mjs';
import { m2Input } from '../m2/fixtures.mjs';

const assert = (value, message = 'assertion failed') => { if (!value) throw new Error(message); };
const same = (a, b) => assert(canonicalM2(a) === canonicalM2(b), 'different values');
async function rejects(action, code) {
  try { await action(); } catch (error) { assert(error.code === code, `${error.code} != ${code}`); return error; }
  throw new Error(`expected ${code}`);
}
async function deferred(action) {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'crypto'), subtle = globalThis.crypto.subtle;
  const calls = [];
  Object.defineProperty(globalThis, 'crypto', { configurable: true, value: { subtle: { digest(algorithm, bytes) {
    return new Promise((resolve, reject) => calls.push({ bytes: new Uint8Array(bytes),
      release: () => subtle.digest(algorithm, bytes).then(resolve, reject), reject }));
  } } } });
  try { return await action(calls); }
  finally { Object.defineProperty(globalThis, 'crypto', descriptor); for (const call of calls) call.release(); }
}
function reverseKeys(x) {
  if (Array.isArray(x)) return x.map(reverseKeys);
  if (x && typeof x === 'object') return Object.fromEntries(Object.entries(x).reverse().map(([k, v]) => [k, reverseKeys(v)]));
  return x;
}

export const snapshotCases = [
  ['M2-S01/S02 snapshot retains BLOCKED, whole Q and immutable dependencies', async () => {
    const snapshot = await api.createM2SnapshotAsync(m2Input());
    assert(snapshot.schemaVersion === 'm2-snapshot-draft-v1' && snapshot.validity === 'CURRENT');
    assert(/^[a-f0-9]{64}$/.test(snapshot.dependencyHash));
    assert(snapshot.result.status === 'BLOCKED' && !snapshot.result.allocations.length && !snapshot.result.paths.length);
    same(snapshot.result.unresolved[0].wholeShare, { numerator: '1', denominator: '3' });
    assert(Object.isFrozen(snapshot.dependencies.m2Policy.rules) && Object.isFrozen(snapshot.result));
    assert(snapshot.dependencies.m2Policy.rules['BL1-R04'] === 'PENDING');
    assert(snapshot.dependencies.m2Policy.rules['BL1-R05'] === 'PENDING');
    assert(!snapshot.result.auditHistory.length);
  }],
  ['M2-S03 object key order is canonical; array order is significant', async () => {
    const x = m2Input(), first = await api.createM2SnapshotAsync(x);
    assert((await api.createM2SnapshotAsync(reverseKeys(x))).dependencyHash === first.dependencyHash);
    x.persons.reverse();
    assert((await api.refreshM2SnapshotAsync(first, x)).validity === 'STALE');
  }],
  ['M2-S01/S02 facts, relations, events, deaths, date, Q, asset, law and truth invalidate without revision change', async () => {
    const original = m2Input();
    for (const change of [
      x => x.eventFacts[0].complete = 'UNKNOWN', x => x.relations[0].review = 'UNKNOWN',
      x => x.events.reverse(), x => x.deathFacts[1].date.value = '2017-01-19',
      x => x.referenceDate.value = '2017-01-15', x => x.root.initialShare.denominator = '5',
      x => x.root.assetId = 'OTHER', x => x.events[0].lawRef.version = 'v2',
      x => x.truthReference = { id: 'Forged', version: 'v1' },
      x => x.persons.push({ personId: 'Extra' }),
      x => { x.events.pop(); x.eventFacts.pop(); },
    ]) {
      // Each mutation must reach capture/hash, not a prior iteration's STALE shortcut.
      const snapshot = await api.createM2SnapshotAsync(original);
      const x = structuredClone(original); change(x);
      const result = await api.refreshM2SnapshotAsync(snapshot, x);
      assert(result.validity === 'STALE' && result.result.status === 'STALE');
      assert(result.dependencyHash === snapshot.dependencyHash);
    }
  }],
  ['M2-S04 public API captures input once even when original changes during digest', async () => {
    const x = m2Input(), before = await api.createM2SnapshotAsync(x);
    await deferred(async calls => {
      const pending = api.createM2SnapshotAsync(x); x.root.initialShare.denominator = '7';
      await calls[0].release(); const snapshot = await pending;
      assert(snapshot.dependencyHash === before.dependencyHash);
      assert(snapshot.result.initialShare.denominator === '3');
    });
  }],
  ['M2-S02 engine, schema, contract, policy, rule, law and approval dependencies invalidate', async () => {
    // Private invalidation-only seam. No approval is installed in calculateM2.
    const baseline = structuredClone((await api.createM2SnapshotAsync(m2Input())).dependencies);
    for (const change of [
      d => d.engineVersion = 'changed', d => d.schemaVersion = 'changed',
      d => d.contractVersion = 'changed', d => d.snapshotVersion = 'changed',
      d => d.m2Policy.version = 'changed', d => d.m2Policy.rules['BL1-R05'] = 'UNKNOWN',
      d => d.m2Policy.bindings.push({ eventId: 'E2', status: 'PENDING' }),
      d => d.c1ApprovalRecord.recordVersion = 'changed',
      d => d.c1ApprovalRecord.rules['BL1-R03'].version = 'changed',
      d => d.c1ApprovalRecord.rules['BL1-R03'].status = 'PENDING',
      d => d.c1ApprovalRecord.law.status = 'PENDING',
    ]) {
      let current = structuredClone(baseline);
      const internal = buildM2SnapshotApi(() => current), s = await internal.createM2SnapshotAsync(m2Input());
      change(current);
      assert((await internal.refreshM2SnapshotAsync(s, m2Input())).validity === 'STALE');
      assert(s.result.status === 'BLOCKED');
    }
  }],
  ['M2-S04 input and dependency copies are pinned before first await', async () => {
    let deps = { version: 'one', rules: { R05: 'PENDING' } };
    const internal = buildM2SnapshotApi(() => deps), x = m2Input();
    await deferred(async calls => {
      const pending = internal.createM2SnapshotAsync(x);
      assert(calls.length === 1, 'capture did not reach digest synchronously');
      const payload = JSON.parse(new TextDecoder().decode(calls[0].bytes));
      x.root.initialShare.denominator = '7'; deps.version = 'two';
      await calls[0].release(); const snapshot = await pending;
      same(snapshot.result.initialShare, payload.input.root.initialShare);
      assert(snapshot.dependencies.version === 'one');
      assert(snapshot.validity === 'STALE' && snapshot.result.status === 'STALE');
    });
  }],
  ['M2-S05 refresh captures changed input before caller restores it; STALE never revives', async () => {
    const x = m2Input(), first = await api.createM2SnapshotAsync(x);
    await deferred(async calls => {
      x.root.initialShare.denominator = '5'; const pending = api.refreshM2SnapshotAsync(first, x);
      x.root.initialShare.denominator = '3'; await calls[0].release();
      const stale = await pending;
      assert(stale.validity === 'STALE');
      assert(await api.refreshM2SnapshotAsync(stale, x) === stale);
      assert(await api.refreshM2SnapshotAsync(first, x) === stale, 'original reference revived');
    });
  }],
  ['M2-S05 overlapping refresh cannot revive a snapshot invalidated by another completion', async () => {
    const x = m2Input(), first = await api.createM2SnapshotAsync(x);
    await deferred(async calls => {
      const unchanged = api.refreshM2SnapshotAsync(first, x);
      x.root.initialShare.denominator = '5'; const changed = api.refreshM2SnapshotAsync(first, x);
      await calls[1].release(); const stale = await changed;
      await calls[0].release(); assert(await unchanged === stale);
    });
    const session = api.createM2Session(); session.setInput(m2Input()); await session.run();
    await api.refreshM2SnapshotAsync(session.getState().snapshot, x);
    assert(session.getState().snapshot === null && session.getState().status === 'STALE');
  }],
  ['M2 schema/ownership rejects C1, JSON restoration and forged results; approval override rejected', async () => {
    await rejects(() => api.refreshM2SnapshotAsync({ dependencyHash: 'fake', result: { status: 'BLOCKED' } }, m2Input()), 'M2_SNAPSHOT_REQUIRED');
    const snapshot = await api.createM2SnapshotAsync(m2Input());
    await rejects(() => api.refreshM2SnapshotAsync(structuredClone(snapshot), m2Input()), 'M2_SNAPSHOT_REQUIRED');
    await rejects(() => api.createM2SnapshotAsync(m2Input(), { approved: true }), 'APPROVAL_OVERRIDE_FORBIDDEN');
    await rejects(() => api.createM2Session({ approvalOverride: true }), 'APPROVAL_OVERRIDE_FORBIDDEN');
    await rejects(() => api.createM2SnapshotAsync({ schemaVersion: 'c1-input-v1' }), 'SCHEMA_VERSION_UNSUPPORTED');
    const bad = m2Input(); bad.root.initialShare.denominator = '0';
    await rejects(() => api.createM2SnapshotAsync(bad), 'NONPOSITIVE_DENOMINATOR');
  }],
  ['M2-S08 invalid new input immediately clears published result; caller mutation cannot alter session-owned input', async () => {
    const session = api.createM2Session(), x = m2Input(); session.setInput(x);
    x.root.initialShare.denominator = '7'; await session.run();
    assert(session.getState().snapshot.result.initialShare.denominator === '3');
    const bad = m2Input(); bad.root.initialShare.denominator = '0';
    await rejects(() => session.setInput(bad), 'NONPOSITIVE_DENOMINATOR');
    assert(session.getState().status === 'ERROR' && session.getState().snapshot === null);
  }],
  ['M2-S07/S08 session input edit immediately clears current result and late success', async () => {
    const session = api.createM2Session(), x = m2Input(); session.setInput(x); await session.run();
    assert(session.getState().status === 'BLOCKED');
    await deferred(async calls => {
      const pending = session.run(); session.setInput({ ...x, inputRevision: '2' });
      assert(session.getState().snapshot === null && session.getState().previousSnapshot.validity === 'STALE');
      await calls[0].release(); assert(!(await pending).published);
      assert(session.getState().snapshot === null);
    });
  }],
  ['M2-S07 newer success wins over older success or older error', async () => {
    for (const failOld of [false, true]) await deferred(async calls => {
      const session = api.createM2Session(); session.setInput(m2Input()); const old = session.run();
      const x = m2Input(); x.root.initialShare.denominator = '5'; session.setInput(x); const fresh = session.run();
      await calls[1].release(); assert((await fresh).published);
      if (failOld) calls[0].reject(new Error('old failure')); else await calls[0].release();
      assert(!(await old).published);
      assert(session.getState().snapshot.result.initialShare.denominator === '5');
      assert(session.getState().status === 'BLOCKED');
    });
  }],
  ['M2-S07/S08 cancel and dependency notification suppress pending completion', async () => {
    for (const method of ['cancel', 'invalidateDependencies']) await deferred(async calls => {
      const session = api.createM2Session(); session.setInput(m2Input()); const pending = session.run();
      session[method](); assert(session.getState().snapshot === null);
      await calls[0].release(); assert(!(await pending).published && session.getState().snapshot === null);
    });
  }],
  ['M2-S07 runtime dependency change during await and after publication invalidates session', async () => {
    let current = { version: 'one', rule: 'PENDING' };
    const internal = buildM2SnapshotApi(() => current), session = internal.createM2Session();
    session.setInput(m2Input());
    await deferred(async calls => {
      const pending = session.run(); current.version = 'two'; await calls[0].release();
      assert(!(await pending).published && session.getState().snapshot === null);
    });
    await session.run(); assert(session.getState().snapshot);
    current.version = 'three'; assert(session.getState().status === 'STALE' && session.getState().snapshot === null);
  }],
  ['M2-S08 missing/failed/malformed Web Crypto publishes no result and raises SnapshotError', async () => {
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
    const session = api.createM2Session(); session.setInput(m2Input()); await session.run();
    try {
      for (const [crypto, code] of [ [{}, 'HASH_UNAVAILABLE'],
        [{ subtle: { get digest() { throw new Error('access denied'); } } }, 'HASH_FAILED'],
        [{ subtle: { digest: async () => { throw new Error('denied'); } } }, 'HASH_FAILED'],
        [{ subtle: { digest: async () => new ArrayBuffer(1) } }, 'HASH_FAILED'] ]) {
        Object.defineProperty(globalThis, 'crypto', { configurable: true, value: crypto });
        const error = await rejects(() => api.createM2SnapshotAsync(m2Input()), code);
        assert(error instanceof api.SnapshotError);
        const result = await session.run(); assert(!result.published && result.error.code === code);
        assert(session.getState().status === 'ERROR' && session.getState().snapshot === null);
      }
    } finally { Object.defineProperty(globalThis, 'crypto', descriptor); }
  }],
];

export async function runM2SnapshotChecks(expectedHash) {
  const results = [];
  for (const [name, action] of snapshotCases) {
    try { await action(); results.push({ name, pass: true }); }
    catch (error) { results.push({ name, pass: false, error: error.stack }); }
  }
  try {
    const actual = (await api.createM2SnapshotAsync(m2Input())).dependencyHash;
    assert(actual === expectedHash, 'Node/browser SHA-256 mismatch');
    results.push({ name: 'M2-S06 Node/browser SHA-256 equality', pass: true });
  } catch (error) { results.push({ name: 'M2-S06 Node/browser SHA-256 equality', pass: false, error: error.stack }); }
  return { results, pass: results.filter(r => r.pass).length, fail: results.filter(r => !r.pass).length, skipped: 0 };
}
