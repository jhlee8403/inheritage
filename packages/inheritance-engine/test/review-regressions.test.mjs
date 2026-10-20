import test from 'node:test';
import assert from 'node:assert/strict';
import { calculate, createSnapshot, refreshSnapshot } from '../src/index.mjs';
import { t01, t02a, t03, person, absent } from './fixtures.mjs';
const shares = r => Object.fromEntries(r.allocations.map(a=>[a.personId,`${a.wholeShare.numerator}/${a.wholeShare.denominator}`]));

test('review regression: spouse and one child',()=>{
  const i=t01();delete i.truthReference;i.family.children.members=[person('Child9','CHILD')];
  assert.deepEqual(shares(calculate(i)),{W:'3/5',Child9:'2/5'});
});
test('review regression: spouse and four children',()=>{
  const i=t01();delete i.truthReference;i.family.children.members=['P1','P2','P3','P4'].map(id=>person(id,'CHILD'));
  assert.deepEqual(shares(calculate(i)),{W:'3/11',P1:'2/11',P2:'2/11',P3:'2/11',P4:'2/11'});
});
test('review regression: sole child without spouse',()=>{
  const i=t01();delete i.truthReference;i.family.spouse=absent();i.family.children.members=[person('Child9','CHILD')];
  assert.deepEqual(shares(calculate(i)),{Child9:'1/1'});
});
test('review regression: single parent record and reversed two-parent order',()=>{
  const one=t02a();delete one.truthReference;one.family.parents.members=one.family.parents.members.filter(p=>p.id==='F');
  assert.deepEqual(shares(calculate(one)),{W:'3/5',F:'2/5'});
  const two=t02a();two.family.parents.members.reverse();
  assert.deepEqual(shares(calculate(two)),{W:'3/7',M:'2/7',F:'2/7'});
});
test('review regression: renamed people, event and actual relationship reference',()=>{
  const i=t03();delete i.truthReference;i.event.id='Event9';i.event.decedentId='Root9';
  i.family.children.members.forEach((p,k)=>p.id=`Desc${k}`);
  i.family.remoteRelatives.members[0].id='Remote9';i.family.remoteRelatives.members[0].viaId='Desc0';
  const r=calculate(i);
  assert.deepEqual(shares(r),{Desc0:'1/3',Desc1:'1/3',Desc2:'1/3'});
  assert.equal(r.nonSelected[0].personId,'Remote9');assert.equal(r.paths[0].pathId,'Event9:Root9:Desc0:DIRECT');
});
test('review regression: child order does not change recipients or fractions',()=>{
  const i=t01();i.family.children.members.reverse();const r=calculate(i);
  assert.deepEqual(shares(r),{W:'3/7',C2:'2/7',C1:'2/7'});
  assert.deepEqual(r.paths.map(p=>p.pathId),['E1:A:W:DIRECT','E1:A:C2:DIRECT','E1:A:C1:DIRECT']);
});
test('review regression: actual person ID and relationship edge changes cause STALE',()=>{
  for (const change of [i=>{i.family.children.members[0].id='New9';},i=>{i.family.remoteRelatives.members[0].viaId='C2';}]) {
    const i=t03();const s=createSnapshot(i);change(i);
    assert.equal(refreshSnapshot(s,i).result.status,'STALE');
    assert.equal(s.result.status,'REVIEW_READY');
  }
});
