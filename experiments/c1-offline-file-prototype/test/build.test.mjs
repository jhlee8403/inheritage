import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
const root=new URL('../../../',import.meta.url), out=new URL('../output/',import.meta.url);
const hash=(x,encoding='hex')=>createHash('sha256').update(x).digest(encoding);
const build=()=>execFileSync(process.execPath,[fileURLToPath(new URL('../scripts/build.mjs',import.meta.url))],{encoding:'utf8'});
build();
const files=['c1-calculator.html','manifest.json','사용방법.txt'];
const before=await Promise.all(files.map(f=>readFile(new URL(f,out))));
const manifest=JSON.parse(before[1]), html=before[0].toString('utf8');
test('file build is byte reproducible without downloads or installed build packages',async()=>{
  build();const after=await Promise.all(files.map(f=>readFile(new URL(f,out))));assert.deepEqual(after,before);
});
test('manifest maps every original source and output to SHA-256',async()=>{
  for(const source of manifest.sources)assert.equal(hash(await readFile(new URL(source.path,root))),source.sha256,source.path);
  assert.equal(hash(await readFile(new URL(manifest.buildScript,root))),manifest.buildScriptSha256);
  assert.equal(hash(before[0]),manifest.outputs[files[0]]);assert.equal(hash(before[2]),manifest.outputs[files[2]]);
});
test('linked sources are C1 only and include original engine, snapshot and session',()=>{
  assert.equal(manifest.modules.length,14);
  for(const id of ['packages/inheritance-engine/src/engine.mjs','packages/inheritance-engine/src/snapshot-browser.mjs','experiments/inheritance-calculator/session.mjs'])assert(manifest.modules.includes(id));
  assert(manifest.modules.every(id=>!id.includes('/m2')&&!id.includes('node_modules')&&!id.includes('offline-ocr')));
});
test('single file embeds CSS/classic script with correct CSP hashes and no asset imports',()=>{
  const script=html.match(/<script>([\s\S]*?)<\/script>/)[1], css=html.match(/<style>([\s\S]*?)<\/style>/)[1];
  assert(html.includes(`script-src 'sha256-${hash(script,'base64')}'`));assert(html.includes(`style-src 'sha256-${hash(css,'base64')}'`));
  assert(html.includes("connect-src 'none'"));assert(!/\bimport\s*(?:\(|\{|\*)/.test(script));
  assert(!html.includes('type="module"'));assert(!/(?:src|href)="(?!data:)[^"]+"/.test(html));
});
test('artifact has portable paths and Windows copy instructions, with pending limits',()=>{
  for(const content of [html,before[1].toString(),before[2].toString()])assert(!content.includes('/Users/')&&!content.includes('127.0.0.1:'));
  assert(html.includes('Ctrl+C'));assert(html.includes('Windows Edge/업무 PC 미검증'));assert(before[2].toString().includes('R04/R05 PENDING'));
});
