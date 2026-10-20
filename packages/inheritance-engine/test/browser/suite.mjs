// Executed in an actual browser through the package's public browser entry.
import * as api from '../../src/browser.mjs';
import { f, t01, t02a, t03, POSITIVE_TRUTHS } from '../fixtures.mjs';
const baseWarnings=['SYNTHETIC_ONLY','STATUTORY_SHARE_ONLY','NOT_A_RIGHTS_DETERMINATION'];
const baseRules=['BL1-G00','BL1-R06','BL1-R07'].map(id=>({id,version:'v1'}));
function canonical(v) {
  if(Array.isArray(v))return v.map(canonical);
  if(v && typeof v==='object')return Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])]));
  return v;
}
function eq(actual,expected) {
  if(JSON.stringify(canonical(actual))!==JSON.stringify(canonical(expected)))throw new Error(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}
function ok(condition,message){if(!condition)throw new Error(message);}
function errorCode(fn,code){try{fn();}catch(e){eq(e.code,code);return;}throw new Error(`Expected error ${code}`);}

export function negativeCases() {
  const t08=t01('BL1-T08');t08.asset.share=f('1','3');t08.family.spouse.existence='UNKNOWN';
  const t09=t01('BL1-T09');t09.asset.share=f('1','3');
  t09.event.openingDate={value:'2017',precision:'YEAR',review:'CONFIRMED'};t09.event.deathOrder='UNKNOWN';
  t09.family.spouse={existence:'ABSENT_CONFIRMED',review:'CONFIRMED',complete:'CONFIRMED',members:[]};
  t09.family.children.members[0].id='B';t09.family.children.members[1].id='C';
  t09.family.children.members[0].life='UNKNOWN';
  t09.family.children.members[0].deathDate={value:'2017',precision:'YEAR',review:'CONFIRMED'};
  const t10=t01('BL1-T10');t10.asset.share=f('1','3');t10.scopeFacts.predeceasedChildBranches='PRESENT';
  const t11=t01('BL1-T11');const pending=structuredClone(api.APPROVALS);pending.rules['BL1-R01'].status='PENDING';
  return [
    {id:'BL1-T08',input:t08,reasons:[{code:'SPOUSE_UNKNOWN',field:'family.spouse.existence'}]},
    {id:'BL1-T09',input:t09,reasons:[{code:'DEATH_DATE_UNCONFIRMED',field:'event.openingDate'},
      {code:'DEATH_ORDER_UNKNOWN',field:'event.deathOrder'},{code:'LIFE_STATUS_UNKNOWN',field:'family.children.B.life'},
      {code:'DEATH_DATE_UNCONFIRMED',field:'family.children.B.deathDate'}]},
    {id:'BL1-T10',input:t10,reasons:[{code:'UNSUPPORTED_SCOPE',field:'scopeFacts.predeceasedChildBranches'}]},
    {id:'BL1-T11',input:t11,approvals:pending,reasons:[{code:'RULE_PENDING',field:'rules',ruleId:'BL1-R01'}]},
  ];
}
export function hashCases() {
  return [...POSITIVE_TRUTHS.map(t=>({id:t.id,input:t.input(),approvals:api.APPROVALS})),
    ...negativeCases().map(t=>({...t,approvals:t.approvals??api.APPROVALS}))];
}
export async function runBrowserChecks(expectedHashes) {
  const results=[];
  async function check(name,work){try{await work();results.push({name,pass:true});}catch(e){results.push({name,pass:false,error:e.stack??String(e)});}}
  await check('public browser entry includes calculation and async snapshots',()=>{
    for(const name of ['calculate','createSnapshotAsync','refreshSnapshotAsync'])eq(typeof api[name],'function');
    eq(api.ENGINE_VERSION,'0.2.0');
  });
  for(const truth of POSITIVE_TRUTHS)await check(truth.id,()=>{
    const input=truth.input();const r=api.calculate(input);
    const rules=['BL1-G00',truth.rule,'BL1-R06','BL1-R07'].map(id=>({id,version:'v1'}));
    eq(r.status,'REVIEW_READY');eq(r.blockedReasons,[]);eq(r.warnings,baseWarnings);eq(r.unresolved,[]);
    eq(r.allocations,truth.whole.map(([personId,n,d],k)=>({personId,wholeShare:f(n,d),
      relativeShare:f(truth.relative[k][1],truth.relative[k][2]),pathIds:[`E1:A:${personId}:DIRECT`]})));
    eq(r.paths,truth.whole.map(([toId,n,d],k)=>({pathId:`E1:A:${toId}:DIRECT`,eventId:'E1',fromId:'A',toId,kind:'DIRECT',
      relativeShare:f(truth.relative[k][1],truth.relative[k][2]),wholeShare:f(n,d),appliedRules:rules,
      lawSnapshotId:'BL1-LAW-2016-14409',truthReference:{id:truth.id,version:'v1'}})));
    eq(r.nonSelected,truth.nonSelected.map(([personId,reason])=>({personId,reason,relativeShare:f('0'),wholeShare:f('0')})));
    eq(r.provenance.appliedRules,rules);eq(r.provenance.truthVersion,'v1');
    eq(r.provenance.lawSnapshotId,'BL1-LAW-2016-14409');eq(r.checks.conservation.total,input.asset.share);
    eq(r.checks.identityPaths,{ok:true,issues:[]});
  });
  await check('BL1-T07',()=>{
    const r=api.evaluateArithmeticPaths({initial:f('2','5'),truthReference:{id:'BL1-T07',version:'v1'},paths:[
      {pathId:'p1',personId:'X',factors:[f('1','3'),f('1','2')]},{pathId:'p2',personId:'X',factors:[f('2','3'),f('1','4')]},
      {pathId:'pY',personId:'Y',factors:[f('2','3')]}]});
    eq(r.status,'ARITHMETIC_ONLY');eq(r.warnings,['NO_LEGAL_CAPACITY_DETERMINATION']);eq(r.unresolved,[]);eq(r.blockedReasons,[]);
    eq(r.allocations,[{personId:'X',pathIds:['p1','p2'],relativeShare:f('1','3'),wholeShare:f('2','15')},
      {personId:'Y',pathIds:['pY'],relativeShare:f('2','3'),wholeShare:f('4','15')}]);
    eq(r.paths.map(p=>[p.pathId,p.personId,p.relativeShare,p.wholeShare]),[
      ['p1','X',f('1','6'),f('1','15')],['p2','X',f('1','6'),f('1','15')],['pY','Y',f('2','3'),f('4','15')]]);
    eq(r.provenance.appliedRules,[{id:'BL1-R06',version:'v1'},{id:'BL1-R07',version:'v1'}]);
    eq(r.provenance.truthVersion,'v1');eq(r.provenance.lawSnapshotId,null);eq(r.provenance.eventId,null);
  });
  for(const t of negativeCases())await check(t.id,()=>{
    const r=api.calculate(t.input,t.approvals??api.APPROVALS);
    eq(r.status,'BLOCKED');eq(r.allocations,[]);eq(r.paths,[]);eq(r.blockedReasons,t.reasons);
    eq(r.unresolved,[{id:'E1:unresolved',eventId:'E1',relativeShare:f('1'),wholeShare:t.input.asset.share,reasons:t.reasons}]);
    eq(r.warnings,[...new Set([...baseWarnings,...t.reasons.map(r=>r.code)])]);
    eq(r.provenance.appliedRules,baseRules);eq(r.provenance.truthVersion,'v1');eq(r.provenance.lawSnapshotId,'BL1-LAW-2016-14409');
  });
  await check('incomplete collection dependencies preserve Q',()=>{
    for(const change of [i=>{delete i.family.children;},i=>{i.family.children=null;},i=>{delete i.family.children.members;},
      i=>{i.family.children.members=null;},i=>{i.family.children.members={};}]) {
      const i=t03();i.asset.share=f('1','3');change(i);const r=api.calculate(i);
      eq(r.status,'BLOCKED');eq(r.allocations,[]);eq(r.paths,[]);eq(r.unresolved[0].wholeShare,f('1','3'));
      ok(r.blockedReasons.some(r=>r.code==='FAMILY_INCOMPLETE'),'Missing incomplete reason');
    }
    const i=t02a();delete i.family.parents;eq(api.calculate(i).status,'BLOCKED');
  });
  await check('valid collection bad viaId, duplicate ID and invalid Q keep InputError',()=>{
    const i=t03();i.family.remoteRelatives.members[0].viaId='Missing';errorCode(()=>api.calculate(i),'MISSING_RELATIONSHIP_REFERENCE');
    const d=t01();d.family.children.members.push(structuredClone(d.family.children.members[0]));errorCode(()=>api.calculate(d),'DUPLICATE_PERSON');
    const q=t01();q.asset.share=f('1','0');errorCode(()=>api.calculate(q),'NONPOSITIVE_DENOMINATOR');
  });
  await check('1024-digit Q: exact growth, conservation, identity, equality and JSON',async()=>{
    const zeros='0'.repeat(1023),i=t01();i.asset.share=f('1',`8${zeros}`);const r=api.calculate(i);
    eq(r.allocations.map(a=>a.wholeShare),[f('3',`56${zeros}`),f('1',`28${zeros}`),f('1',`28${zeros}`)]);
    ok(api.validateConservation(r).ok,'Conservation');ok(api.validateIdentityPaths(r).ok,'Identity');
    ok(api.equal(api.sum(r.allocations.map(a=>a.wholeShare)),api.initialShare(i.asset.share)),'Equality');
    eq(JSON.parse(JSON.stringify(r)).allocations,r.allocations);
    const snapshot=await api.createSnapshotAsync(i);i.inputRevision='2';
    const stale=await api.refreshSnapshotAsync(snapshot,i);eq(stale.result.status,'STALE');eq(stale.result.allocations,r.allocations);
    ok(api.validateConservation(stale.result).ok,'Stale long conservation');ok(api.validateIdentityPaths(stale.result).ok,'Stale long paths');
    errorCode(()=>api.fraction(f('1',`8${'0'.repeat(1024)}`)),'INVALID_INTEGER_STRING');
  });
  await check('Node/browser SHA-256 equality for 10 legal truth inputs',async()=>{
    for(const c of hashCases())eq((await api.createSnapshotAsync(c.input,c.approvals)).dependencyHash,expectedHashes[c.id]);
  });
  await check('snapshot changes and irreversible STALE',async()=>{
    const i=t03(),s=await api.createSnapshotAsync(i);
    ok(Object.isFrozen(s.result.allocations),'Immutable result');
    for(const change of [i=>{i.family.children.members[0].id='Other';},i=>{i.family.remoteRelatives.members[0].viaId='C2';},
      i=>{i.event.openingDate.value='2017-01-20';},i=>{i.asset.share=f('1','3');}]) {
      const next=structuredClone(i);change(next);const stale=await api.refreshSnapshotAsync(s,next);
      eq(stale.result.status,'STALE');ok(stale.result.warnings.includes('STALE_RESULT_DO_NOT_USE'),'Stale warning');
      eq((await api.refreshSnapshotAsync(stale,i)).result.status,'STALE');
    }
    const pending=structuredClone(api.APPROVALS);pending.rules['BL1-R07'].status='PENDING';
    eq((await api.refreshSnapshotAsync(s,i,pending)).result.status,'STALE');
  });
  await check('async creation uses same pinned input/approval copies',async()=>{
    const i=t01(),a=structuredClone(api.APPROVALS),original=await api.createSnapshotAsync(i,a);
    const work=api.createSnapshotAsync(i,a);i.asset.share=f('1','3');a.rules['BL1-R01'].status='PENDING';
    eq(await work,original);
  });
  await check('async refresh captures change before caller reverts',async()=>{
    const i=t01(),s=await api.createSnapshotAsync(i);i.asset.share=f('1','3');
    const work=api.refreshSnapshotAsync(s,i);i.asset.share=f('1');eq((await work).result.status,'STALE');
    const a=structuredClone(api.APPROVALS);a.rules['BL1-R01'].status='PENDING';
    const approvalWork=api.refreshSnapshotAsync(s,i,a);a.rules['BL1-R01'].status='APPROVED_FOR_C1';
    eq((await approvalWork).result.status,'STALE');
  });
  await check('unavailable or failing Web Crypto reports explicit error',async()=>{
    const descriptor=Object.getOwnPropertyDescriptor(globalThis,'crypto');
    try {
      Object.defineProperty(globalThis,'crypto',{configurable:true,value:{}});
      let code;try{await api.createSnapshotAsync(t01());}catch(e){code=e.code;}
      eq(code,'HASH_UNAVAILABLE');
      Object.defineProperty(globalThis,'crypto',{configurable:true,value:{subtle:{digest:async()=>{throw new Error('denied');}}}});
      code=undefined;try{await api.createSnapshotAsync(t01());}catch(e){code=e.code;}
      eq(code,'HASH_FAILED');
    } finally {Object.defineProperty(globalThis,'crypto',descriptor);}
  });
  return {results,pass:results.filter(r=>r.pass).length,fail:results.filter(r=>!r.pass).length,skipped:0};
}
