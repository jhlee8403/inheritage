import test from 'node:test';
import assert from 'node:assert/strict';
import { createSnapshot, refreshSnapshot, APPROVALS, validateConservation, validateIdentityPaths } from '../src/index.mjs';
import { createSnapshotAsync, refreshSnapshotAsync, calculate } from '../src/browser.mjs';
import { t01, f } from './fixtures.mjs';

test('Web Crypto and Node SHA-256 use identical dependencies and synchronous API stays synchronous', async () => {
  const input = t01(); const node = createSnapshot(input);
  assert.equal(node instanceof Promise, false);
  const browser = await createSnapshotAsync(input);
  assert.match(browser.dependencyHash, /^[a-f0-9]{64}$/);
  assert.equal(browser.dependencyHash, node.dependencyHash);
  assert.deepEqual(browser.result, node.result);
  assert.strictEqual(await refreshSnapshotAsync(browser,input), browser);
  assert.strictEqual(refreshSnapshot(node,input),node);
});
test('async creation pins both input and approval copies before await', async () => {
  const input = t01(); const approvals = structuredClone(APPROVALS);
  const original = createSnapshot(input,approvals);
  const pending = createSnapshotAsync(input,approvals);
  input.asset.share = f('1','3'); approvals.rules['BL1-R01'].status = 'PENDING';
  const snapshot = await pending;
  assert.deepEqual(snapshot,original);
  assert.equal(calculate(input,approvals).status,'BLOCKED');
  assert.equal(snapshot.result.status,'REVIEW_READY');
});
test('async refresh pins dependencies, is immutable and never revives STALE', async () => {
  const input = t01(); const approvals = structuredClone(APPROVALS);
  const snapshot = await createSnapshotAsync(input,approvals);
  input.asset.share = f('1','3');
  const pending = refreshSnapshotAsync(snapshot,input,approvals);
  input.asset.share = f('1'); // revert after call, before Web Crypto resolves
  const stale = await pending;
  assert.equal(stale.result.status,'STALE');
  assert.ok(stale.result.warnings.includes('STALE_RESULT_DO_NOT_USE'));
  assert.strictEqual(await refreshSnapshotAsync(stale,input),stale);
  assert.equal(snapshot.result.status,'REVIEW_READY');
  assert.throws(()=>{stale.result.allocations[0].personId='Other';},TypeError);
  const next = structuredClone(APPROVALS);next.rules['BL1-R06'].status='PENDING';
  assert.equal((await refreshSnapshotAsync(snapshot,input,next)).result.status,'STALE');
});
test('hash unavailable/failure is explicit; no constant hash or silent success fallback', async () => {
  const snapshot = await createSnapshotAsync(t01());
  const descriptor = Object.getOwnPropertyDescriptor(globalThis,'crypto');
  try {
    Object.defineProperty(globalThis,'crypto',{configurable:true,value:{}});
    await assert.rejects(createSnapshotAsync(t01()),{code:'HASH_UNAVAILABLE'});
    await assert.rejects(refreshSnapshotAsync(snapshot,t01()),{code:'HASH_UNAVAILABLE'});
    Object.defineProperty(globalThis,'crypto',{configurable:true,value:{subtle:{digest:async()=>{throw new Error('denied');}}}});
    await assert.rejects(createSnapshotAsync(t01()),{code:'HASH_FAILED'});
  } finally { Object.defineProperty(globalThis,'crypto',descriptor); }
});
test('long internal fractions also remain valid in immutable snapshots and STALE copies', async () => {
  const input=t01();input.asset.share=f('1','8'+'0'.repeat(1023));
  const snapshot=await createSnapshotAsync(input);
  assert.equal(snapshot.result.status,'REVIEW_READY');
  const node=createSnapshot(input);assert.equal(node.dependencyHash,snapshot.dependencyHash);
  input.inputRevision='2';
  const stale=await refreshSnapshotAsync(snapshot,input);
  assert.equal(stale.result.status,'STALE');
  assert.deepEqual(stale.result.allocations,snapshot.result.allocations);
  assert.ok(validateConservation(stale.result).ok);
  assert.ok(validateIdentityPaths(stale.result).ok);
});
