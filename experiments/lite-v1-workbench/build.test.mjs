import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
const here=import.meta.url,hash=b=>createHash('sha256').update(b).digest('hex');
const get=f=>readFile(new URL(f,here));
const before=await get('generated/lite-v1.html'),record=JSON.parse(await get('results/build.json'));
test('generated C1 script is byte-identical to the protected C1 artifact',async()=>{
 const original=(await get('../c1-offline-file-prototype/output/c1-calculator.html')).toString().match(/<script>([\s\S]*)<\/script>/)[1];
 const script=before.toString().match(/<script>([\s\S]*)<\/script>/)[1];assert(script.startsWith(original+'\n;'));assert.equal(hash(original),record.c1ScriptSha256);
});
test('single file hash and SHA-256 CSP match, no external resource tags',()=>{
 assert.equal(hash(before),record.sha256);assert.equal(before.length,record.bytes);const html=before.toString(),script=html.match(/<script>([\s\S]*)<\/script>/)[1];
 assert(html.includes(`script-src 'sha256-${createHash('sha256').update(script).digest('base64')}'`));assert(html.includes("connect-src 'none'"));assert(!/(?:src|href)="(?!data:)[^"]+"/.test(html));assert(!html.includes('/Users/'));assert(!html.includes('type="module"'));
});
test('rebuild is byte reproducible from locked local resources',async()=>{
 execFileSync(process.execPath,[fileURLToPath(new URL('build.mjs',here))],{timeout:15000});assert.deepEqual(await get('generated/lite-v1.html'),before);
});
test('instructions and redistribution notice have recorded hashes',async()=>{
 assert.equal(hash(await get('generated/Windows-시험안내.txt')),record.instructionsSha256);assert.equal(hash(await get('generated/NOTICE.txt')),record.notice.sha256);
});
