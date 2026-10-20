import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { calculate, initialShare, fraction, add, multiply, sum, equal,
  validateConservation, validateIdentityPaths } from '../src/index.mjs';
import { t01, t02a, t03, f } from './fixtures.mjs';

const variants = [
  ['missing collection', i => { delete i.family.children; }],
  ['null collection', i => { i.family.children = null; }],
  ['missing members', i => { delete i.family.children.members; }],
  ['null members', i => { i.family.children.members = null; }],
  ['object members', i => { i.family.children.members = {}; }],
];
for (const [name, change] of variants) {
  test(`collection dependency: children ${name}`, () => {
    const input = t03(); input.asset.share = f('1','3'); change(input);
    const before = structuredClone(input);
    const result = calculate(input);
    assert.equal(result.status, 'BLOCKED');
    assert.ok(result.blockedReasons.some(r => r.code === 'FAMILY_INCOMPLETE' && r.field.startsWith('family.children')));
    assert.deepEqual(result.allocations, []); assert.deepEqual(result.paths, []);
    assert.equal(result.unresolved.length, 1);
    assert.deepEqual(result.unresolved[0].wholeShare, f('1','3'));
    assert.deepEqual(input, before);
  });
}
test('collection dependency: parents missing/null/malformed with GRANDPARENT reference', () => {
  for (const change of [i=>{delete i.family.parents;},i=>{i.family.parents=null;},
    i=>{delete i.family.parents.members;},i=>{i.family.parents.members=null;},i=>{i.family.parents.members={};}]) {
    const input = t02a(); change(input);
    const result = calculate(input);
    assert.equal(result.status, 'BLOCKED');
    assert.ok(result.blockedReasons.some(r => r.code === 'FAMILY_INCOMPLETE'));
    assert.deepEqual(result.allocations, []); assert.deepEqual(result.paths, []);
    assert.deepEqual(result.unresolved[0].wholeShare, f('1'));
  }
});
test('collection dependency: unreviewed/incomplete via collection must not be searched', () => {
  for (const field of ['review','complete']) {
    const input = t03(); input.family.children[field] = 'UNKNOWN';
    input.family.remoteRelatives.members[0].viaId = 'UnverifiedPerson';
    const result = calculate(input);
    assert.equal(result.status, 'BLOCKED');
    assert.ok(result.blockedReasons.some(r => ['FAMILY_INCOMPLETE','FACT_UNCONFIRMED'].includes(r.code)));
  }
});

test('browser public export graph has no Node-only imports', () => {
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  const main = typeof pkg.exports === 'string' ? pkg.exports : pkg.exports['.'].browser;
  assert.ok(main, 'A browser public entry is required');
  const forbidden = []; const seen = new Set();
  function visit(path) {
    if (seen.has(path)) return; seen.add(path);
    const source = readFileSync(path, 'utf8');
    const imports = source.matchAll(/(?:import|export)\s+(?:[^;]*?\sfrom\s+)?['"]([^'"]+)['"]/g);
    for (const [,specifier] of imports) {
      if (specifier.startsWith('node:')) forbidden.push(specifier);
      else if (specifier.startsWith('.')) visit(resolve(dirname(path),specifier));
      else assert.fail(`Unexpected bare dependency: ${specifier}`);
    }
  }
  visit(resolve(dirname(fileURLToPath(new URL('../package.json', import.meta.url))),main));
  assert.deepEqual(forbidden, []);
});

// D=8*10^k. Independently: (3/7)/D=3/(56*10^k), (2/7)/D=1/(28*10^k).
// These literal decimal formulas do not call the engine to build expected values.
for (const digits of [1023,1024]) {
  test(`fraction input ${digits} digits: internal growth, integrity and JSON`, () => {
    const zeros = '0'.repeat(digits-1);
    const input = t01(); input.asset.share = f('1',`8${zeros}`);
    const result = calculate(input);
    assert.equal(result.status, 'REVIEW_READY');
    assert.deepEqual(result.allocations.map(a => a.wholeShare), [f('3',`56${zeros}`),f('1',`28${zeros}`),f('1',`28${zeros}`)]);
    assert.ok(validateConservation(result).ok);
    assert.ok(validateIdentityPaths(result).ok);
    assert.ok(equal(sum(result.allocations.map(a => a.wholeShare)), initialShare(input.asset.share)));
    for (const path of result.paths) {
      const allocation = result.allocations.find(a => a.personId === path.toId);
      assert.ok(equal(path.wholeShare, allocation.wholeShare));
    }
    if (digits === 1024) {
      // A copied/JSON external object cannot forge the private internal-value identity.
      assert.throws(() => add({...result.allocations[0].wholeShare},f('0')), {code:'INVALID_INTEGER_STRING'});
      const external=t01(); external.asset.share=result.allocations[0].wholeShare;
      assert.throws(() => calculate(external), {code:'INVALID_INTEGER_STRING'});
    }
    assert.deepEqual(JSON.parse(JSON.stringify(result)).allocations.map(a => a.wholeShare),
      [f('3',`56${zeros}`),f('1',`28${zeros}`),f('1',`28${zeros}`)]);
  });
}
test('external 1025 digit inputs and unbranded long objects remain rejected', () => {
  const long = f('1',`8${'0'.repeat(1024)}`);
  for (const operation of [() => fraction(long), () => initialShare(long), () => add(long,f('0')),
    () => multiply(long,f('1')), () => equal(long,long)]) {
    assert.throws(operation, { code: 'INVALID_INTEGER_STRING' });
  }
  const input = t01(); input.asset.share = long;
  assert.throws(() => calculate(input), { code: 'INVALID_INTEGER_STRING' });
});

test('large common divisor reduction stays exact', () => {
  const zeros='0'.repeat(1000);
  assert.deepEqual(fraction(f(`9${zeros}`,`27${zeros}`)),f('1','3'));
});
