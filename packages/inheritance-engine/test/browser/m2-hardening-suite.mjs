import * as api from '../../src/m2.mjs';
import { m2Input, technicalLedger } from '../m2/fixtures.mjs';

const assert = (value, message = 'assertion failed') => { if (!value) throw new Error(message); };
async function rejects(action, code, field) {
  try { await action(); } catch (error) {
    assert(error.code === code, `${error.code} != ${code}`);
    if (field) assert(error.field === field, `${error.field} != ${field}`);
    return;
  }
  throw new Error(`expected ${code}`);
}
export const hardeningCases = [
  ['review: refresh input failure invalidates original reference and session publication', async () => {
    const session = api.createM2Session(), good = m2Input(); session.setInput(good); await session.run();
    const original = session.getState().snapshot, bad = m2Input(); bad.root.initialShare.denominator = '0';
    await rejects(() => api.refreshM2SnapshotAsync(original, bad), 'NONPOSITIVE_DENOMINATOR', 'fraction.denominator');
    assert(session.getState().snapshot === null, 'failed refresh left old result published');
    const checked = await api.refreshM2SnapshotAsync(original, good);
    assert(checked.validity === 'STALE', 'failed refresh allowed original reference to revive');
  }],
  ['review: refresh hash failure invalidates original reference without masking SnapshotError', async () => {
    const original = await api.createM2SnapshotAsync(m2Input());
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
    try {
      Object.defineProperty(globalThis, 'crypto', { configurable: true, value: { subtle: { digest: async () => { throw new Error('denied'); } } } });
      await rejects(() => api.refreshM2SnapshotAsync(original, m2Input()), 'HASH_FAILED');
    } finally { Object.defineProperty(globalThis, 'crypto', descriptor); }
    assert((await api.refreshM2SnapshotAsync(original, m2Input())).validity === 'STALE', 'hash failure reused old result');
  }],
  ['review: refresh failure defeats an older pending unchanged refresh', async () => {
    const original = await api.createM2SnapshotAsync(m2Input());
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'crypto'), subtle = globalThis.crypto.subtle;
    let release;
    try {
      Object.defineProperty(globalThis, 'crypto', { configurable: true, value: { subtle: { digest: (algorithm, bytes) => new Promise((resolve, reject) => {
        release = () => subtle.digest(algorithm, bytes).then(resolve, reject);
      }) } } });
      const pending = api.refreshM2SnapshotAsync(original, m2Input());
      const bad = m2Input(); bad.events[1].factsRef = 'Missing';
      await rejects(() => api.refreshM2SnapshotAsync(original, bad), 'BROKEN_REFERENCE');
      await release(); assert((await pending).validity === 'STALE', 'late unchanged refresh revived result');
    } finally { Object.defineProperty(globalThis, 'crypto', descriptor); if (release) await release(); }
  }],
  ['review: foreign snapshot rejected without reading attacker accessor', async () => {
    let accessed = false;
    const foreign = { get schemaVersion() { accessed = true; throw new Error('accessor executed'); } };
    await rejects(() => api.refreshM2SnapshotAsync(foreign, m2Input()), 'M2_SNAPSHOT_REQUIRED');
    assert(!accessed, 'foreign getter executed');
  }],
  ['review: custom array prototype rejected at JSON object boundary', async () => {
    const x = m2Input(); class CustomArray extends Array {}
    x.persons = CustomArray.from(x.persons);
    await rejects(() => api.calculateM2(x), 'NON_JSON_INPUT', '$.persons');
  }],
  ['review: raw prototype keys, escaped duplicates and nested approval fields cannot bypass policy', async () => {
    const parsed = api.parseM2InputJson('{"__proto__":{"polluted":true}}');
    assert(Object.hasOwn(parsed, '__proto__') && Object.getPrototypeOf(parsed) === Object.prototype);
    assert(({}).polluted === undefined);
    await rejects(() => api.parseM2InputJson('{"__proto__":1,"\\u005f_proto__":2}'), 'DUPLICATE_JSON_KEY');
    const x = m2Input(); x.eventFacts[0].families[0].spouse.approvalOverride = true;
    await rejects(() => api.calculateM2Json(JSON.stringify(x)), 'UNSUPPORTED_INPUT_FIELD');
  }],
  ['review: object attributes/symbols and raw invalid types remain strict InputError', async () => {
    let accessed = false; const x = m2Input();
    Object.defineProperty(x.persons[0], 'personId', { enumerable: true, get() { accessed = true; return 'A'; } });
    await rejects(() => api.calculateM2(x), 'NON_JSON_INPUT', '$.persons[0].personId');
    assert(!accessed);
    const y = m2Input(); y[Symbol('approval')] = true;
    await rejects(() => api.calculateM2(y), 'NON_JSON_INPUT');
    for (const value of [null, false, 1, []]) await rejects(() => api.calculateM2Json(JSON.stringify(value)), 'INVALID_OBJECT');
  }],
  ['review: technical ledger differently named alias still cannot consume one inflow twice', async () => {
    const x = technicalLedger(); x.events.push({ eventId: 'DifferentTarget', decedentId: 'P1' });
    x.consumptions.push({ ...x.consumptions[0], targetEventId: 'DifferentTarget' });
    await rejects(() => api.validateM2TechnicalLedger(x), 'DUPLICATE_INFLOW_CONSUMPTION');
  }],
];

export async function runM2HardeningChecks() {
  const results = [];
  for (const [name, action] of hardeningCases) {
    try { await action(); results.push({ name, pass: true }); }
    catch (error) { results.push({ name, pass: false, error: error.stack }); }
  }
  return { results, pass: results.filter(r => r.pass).length, fail: results.filter(r => !r.pass).length, skipped: 0 };
}
