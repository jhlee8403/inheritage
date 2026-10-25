import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { audit,sha256 } from './assets.mjs';
test('all existing runtime resources match locked bytes and SHA-256 without repair/download',async()=>{
  const result=await audit();assert.equal(result.runtimeFiles,228);assert.equal(result.verified,228);assert.deepEqual(result.failures,[]);
});
test('direct PDF build is byte reproducible and vendor-bearing output is gitignored',async()=>{
  const run=()=>execFileSync(process.execPath,[fileURLToPath(new URL('build-direct.mjs',import.meta.url))]);
  run();const before=await readFile(new URL('generated/direct-text.html',import.meta.url));run();
  assert.deepEqual(await readFile(new URL('generated/direct-text.html',import.meta.url)),before);
  const metadata=JSON.parse(await readFile(new URL('results/direct-build.json',import.meta.url),'utf8'));
  assert.equal(metadata.sha256,sha256(before));assert(before.toString().includes("worker-src 'none'"));
  execFileSync('git',['check-ignore',fileURLToPath(new URL('generated/direct-text.html',import.meta.url))]);
});
