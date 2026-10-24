import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { snapshotCases } from './browser/m2-snapshot-suite.mjs';
import { createM2SnapshotAsync, refreshM2SnapshotAsync } from '../src/m2.mjs';
import { canonicalM2 } from '../src/m2/snapshot-internal.mjs';
import { createSnapshot } from '../src/snapshot.mjs';
import { t01 } from './fixtures.mjs';
import { m2Input } from './m2/fixtures.mjs';

for (const [name, action] of snapshotCases) test(name, action);
test('M2-S06 Web Crypto hash equals independent Node createHash', async () => {
  const input = m2Input(), snapshot = await createM2SnapshotAsync(input);
  const expected = createHash('sha256').update(canonicalM2({ input, dependencies: snapshot.dependencies })).digest('hex');
  assert.equal(snapshot.dependencyHash, expected);
});
test('actual C1 snapshot is explicitly rejected by M2 refresh', async () => {
  await assert.rejects(refreshM2SnapshotAsync(createSnapshot(t01()), m2Input()), { code: 'M2_SNAPSHOT_REQUIRED' });
});
