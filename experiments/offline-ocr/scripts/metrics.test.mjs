import test from 'node:test';
import assert from 'node:assert/strict';
import {align,measure} from './metrics.mjs';
test('alignment distinguishes missing, extra, mistaken Korean characters',()=>{
  assert.equal(align('가나다','가다').deletions,1);
  assert.equal(align('가다','가나다').insertions,1);
  assert.equal(align('가나다','가마 다'.replace(' ', '')).substitutions,1);
});
test('date punctuation remains significant; whitespace normalization is explicit',()=>{
  const r=measure({expectedText:'성명: 가온새\n2001-02-03 金',fields:{name:'가온새',date:'2001-02-03',hanja:'金'}},'성명: 가 온 새\n2001/02/03 全');
  assert.equal(r.fields.name.exactSubstring,true);
  assert.equal(r.fields.date.exactSubstring,false);
  assert.equal(r.hanja.substitutions,1);
  assert.equal(r.numbers.editDistance,0);
});
