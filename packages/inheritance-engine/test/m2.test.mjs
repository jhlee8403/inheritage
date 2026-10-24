import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateM2,calculateM2Json,parseM2InputJson,validateM2TechnicalLedger,M2_POLICY,M2_LIMITS,InputError } from '@inheritage/inheritance-engine/m2';
import { APPROVALS,calculate } from '../src/index.mjs';
import { t01 } from './fixtures.mjs';
import { m2Input,technicalLedger,fraction as f } from './m2/fixtures.mjs';
function blocked(input,code,field) {
  const before=structuredClone(input),r=calculateM2(input);
  assert.equal(r.status,'BLOCKED');assert.equal(r.legalDetermination,'NOT_PERFORMED');
  for(const key of ['allocations','paths','acquisitions','branchBases','consumptions','auditHistory'])assert.deepEqual(r[key],[]);
  assert.deepEqual(r.unresolved,[{id:'ROOT-UNRESOLVED',rootAssetId:input.root.assetId,rootRelativeShare:f('1'),wholeShare:r.initialShare}]);
  assert.equal(r.checks.rootConservation.ok,true);assert.deepEqual(r.checks.rootConservation.total,r.initialShare);
  assert.equal(r.checks.legalAllocation.status,'NOT_RUN');assert.deepEqual(r.provenance.appliedRules,[]);
  assert(r.warnings.includes('UNRESOLVED_IS_NOT_ZERO_LEGAL_SHARE'));
  if(code)assert(r.blockedReasons.some(b=>b.code===code&&(!field||b.field===field)),JSON.stringify(r.blockedReasons));
  assert.deepEqual(input,before);assert(Object.isFrozen(r));return r;
}
function error(action,code,field) { assert.throws(action,e=>{assert(e instanceof InputError);assert.equal(e.code,code);if(field)assert.equal(e.field,field);return true;}); }
for(const [module,ruleId] of [['M2_REPRESENTATION','BL1-R04'],['M2_SUCCESSIVE','BL1-R05']])test(`M2 complete ${module} reaches pending gate without allocation`,()=>{
  const r=blocked(m2Input(module),'RULE_PENDING');assert.equal(r.checks.facts.status,'COMPLETE');
  assert(r.blockedReasons.some(b=>b.code==='RULE_PENDING'&&b.ruleId===ruleId));
  for(const event of r.eventResults)assert(r.blockedReasons.some(b=>b.code==='DEPENDENCY_SCOPE_PENDING'&&b.eventId===event.eventId&&b.ruleId==='BL1-R03'));
  assert.deepEqual(calculateM2Json(JSON.stringify(m2Input(module))),r);
});
test('M2 exact Q normalization and 1024-digit boundary',()=>{
  for(const q of [f('1'),f('2','6'),f('9007199254740993','27021597764222979'),f('1','1'+'0'.repeat(1023))]){const x=m2Input();x.root.initialShare=q;const r=blocked(x);if(q.numerator==='2')assert.deepEqual(r.initialShare,f('1','3'));}
  const x=m2Input();x.root.initialShare=f('1','1'+'0'.repeat(1024));error(()=>calculateM2(x),'INVALID_INTEGER_STRING','asset.share.denominator');
});
for(const [q,code,field] of [[f('1','0'),'NONPOSITIVE_DENOMINATOR','fraction.denominator'],[f('-1','3'),'NEGATIVE_SHARE','fraction.numerator'],[f('0'),'INITIAL_SHARE_OUT_OF_RANGE','asset.share'],[f('2'),'INITIAL_SHARE_OUT_OF_RANGE','asset.share'],[f('bad','3'),'INVALID_INTEGER_STRING','asset.share.numerator'],[{numerator:1,denominator:'3'},'INVALID_INTEGER_STRING','asset.share.numerator']])test(`M2 malformed Q ${JSON.stringify(q)}`,()=>{const x=m2Input();x.root.initialShare=q;error(()=>calculateM2(x),code,field);});
test('M2 truth omission/change/forgery cannot mutate or replace approval policy',()=>{
  const policy=JSON.stringify(M2_POLICY),c1=JSON.stringify(APPROVALS);
  for(const truth of [null,{id:'BL1-T04',version:'v1'},{id:'Forged',version:'APPROVED'}]){const x=m2Input();if(truth)x.truthReference=truth;const r=blocked(x,'RULE_PENDING');if(truth)assert(r.blockedReasons.some(b=>b.code==='TRUTH_PENDING'));}
  assert.equal(JSON.stringify(M2_POLICY),policy);assert.equal(JSON.stringify(APPROVALS),c1);assert.equal(APPROVALS.rules['BL1-R04'].status,'PENDING');assert.equal(APPROVALS.rules['BL1-R05'].status,'PENDING');
  const x=m2Input();x.truthReference={id:'bad id',version:'v1'};error(()=>calculateM2(x),'INVALID_ID','truthReference.id');
  error(()=>calculateM2(m2Input(),{approved:true}),'APPROVAL_OVERRIDE_FORBIDDEN','arguments');
});
for(const [location,key] of [['root','approved'],['events.0.lawRef','status'],['persons.0','proof'],['','approvalOverride'],['','allocations']])test(`M2 rejects injected ${location}.${key}`,()=>{const x=m2Input();const o=location?location.split('.').reduce((o,k)=>o[k],x):x;o[key]=true;error(()=>calculateM2(x),'UNSUPPORTED_INPUT_FIELD');});
test('M2/C1 inputs and existing C1 results cannot be mixed',()=>{
  error(()=>calculateM2(t01()),'SCHEMA_VERSION_UNSUPPORTED','schemaVersion');error(()=>calculateM2(calculate(t01())),'SCHEMA_VERSION_UNSUPPORTED','schemaVersion');
  const x=m2Input();x.paths=calculate(t01()).paths;error(()=>calculateM2(x),'UNSUPPORTED_INPUT_FIELD','$.paths');
  assert.throws(()=>calculate(m2Input()),{code:'INVALID_SCHEMA'});
});
for(const [key,idKey] of [['persons','personId'],['relations','relationId'],['deathFacts','deathFactId'],['events','eventId'],['eventFacts','factsId']])test(`M2 duplicate ${key} ID`,()=>{const x=m2Input();x[key].push(structuredClone(x[key][0]));error(()=>calculateM2(x),'DUPLICATE_ID');x[key].pop();x[key][0][idKey]='bad id';error(()=>calculateM2(x),'INVALID_ID');});
for(const [name,change] of [['person',x=>x.relations[0].childId='Missing'],['source event',x=>x.events[1].incomingRequest.sourceEventId='Missing'],['facts',x=>x.eventFacts=[]],['death',x=>x.events[0].deathFactId='Missing'],['collection relation',x=>x.eventFacts[0].families[0].children.memberRelationIds=['Missing']]])test(`M2 broken ${name} reference is InputError`,()=>{const x=m2Input();change(x);error(()=>calculateM2(x),'BROKEN_REFERENCE');});
test('M2 incomplete facts are BLOCKED, dangling records are not',()=>{
  for(const change of [x=>delete x.eventFacts[0].families,x=>delete x.eventFacts[0].families[0].children.memberRelationIds,x=>x.eventFacts[0].complete='UNKNOWN']){const x=m2Input();change(x);assert.equal(blocked(x).checks.facts.status,'INCOMPLETE');}
  const x=m2Input();x.eventFacts.shift();error(()=>calculateM2(x),'BROKEN_REFERENCE','events.E1.factsRef');
});
test('M2 UNKNOWN does not become ABSENT_CONFIRMED and contradictory data errors',()=>{
  const x=m2Input();x.eventFacts[0].families[0].spouse.existence='UNKNOWN';blocked(x,'EXISTENCE_UNKNOWN');assert.equal(x.eventFacts[0].families[0].spouse.existence,'UNKNOWN');
  x.eventFacts[0].families[0].spouse.existence='ABSENT_CONFIRMED';x.eventFacts[0].families[0].spouse.members=['C'];error(()=>calculateM2(x),'CONTRADICTORY_COLLECTION');
});
test('M2 relationship self-loop, directed cycle and semantic duplicate reject',()=>{
  for(const [parentId,childId,code] of [['A','A','STRUCTURAL_CYCLE'],['G1','A','STRUCTURAL_CYCLE'],['A','B','DUPLICATE_RELATIONSHIP']]){const x=m2Input();x.relations.push({relationId:'Extra',parentId,childId,kind:'BIOLOGICAL',review:'CONFIRMED'});error(()=>calculateM2(x),code);}
});
test('M2 event cycle and repeated semantic inflow reject before pending gate',()=>{
  const cycle=m2Input();cycle.events[0].incomingRequest={kind:'FROM_EVENT',sourceEventId:'E2',recipientId:'A'};error(()=>calculateM2(cycle),'STRUCTURAL_CYCLE','events');
  const x=m2Input();x.events.push({...structuredClone(x.events[1]),eventId:'E3',factsRef:'F3'});x.eventFacts.push({...structuredClone(x.eventFacts[1]),factsId:'F3',eventId:'E3'});error(()=>calculateM2(x),'DUPLICATE_INFLOW_CONSUMPTION');
});
test('M2 unknown death order and future policy remain blocked',()=>{
  const x=m2Input();x.deathFacts[1].date={value:'2017',precision:'YEAR',review:'CONFIRMED'};blocked(x,'DEATH_ORDER_UNKNOWN');
  const y=m2Input();y.referenceDate.value='2017-01-15';const r=blocked(y,'FUTURE_EVENT_POLICY_PENDING');assert(r.eventResults.every(e=>e.status==='NOT_EVALUATED'));
  y.deathFacts[1].date.value='2017-01-10';blocked(y,'EVENT_ORDER_CONFLICT');
});
test('M2 law/date/fact dependencies are diagnosed, not activated',()=>{
  const x=m2Input();delete x.events[1].lawRef;blocked(x,'LAW_UNCONFIRMED');
  x.referenceDate.review='UNKNOWN';blocked(x,'DATE_UNCONFIRMED');x.deathFacts[0].date.value='2017-02-30';error(()=>calculateM2(x),'INVALID_DATE','deathFacts.DA.date');
});
test('M2 confirmed life/date contradictions are BLOCKED, not a choice of inheritance route',()=>{
  const x=m2Input('M2_REPRESENTATION');x.deathFacts[1].date.value='2017-01-20';blocked(x,'LIFE_DATE_CONFLICT');
  const y=m2Input();y.eventFacts[0].lifeStates[1].value='DEAD_AT_OPEN';blocked(y,'LIFE_STATUS_CONFLICT');
});
test('M2 missing facts, conflicting roster and unsupported scope stay nonlegal BLOCKED',()=>{
  const x=m2Input();x.eventFacts[0].families[0].children.memberRelationIds=['AB'];blocked(x,'FACTS_CONFLICTED');
  const y=m2Input();y.eventFacts[0].scopeFacts.adoption='PRESENT';blocked(y,'UNSUPPORTED_SCOPE');
  const z=m2Input();z.eventFacts[0].adultStates[0].review='UNKNOWN';blocked(z,'ADULT_STATUS_UNKNOWN');
});
test('M2 conflicting death assertions are facts conflict, not reference repair',()=>{
  const x=m2Input();x.deathFacts.push({deathFactId:'DB2',personId:'B',date:{value:'2017-01-19',precision:'DAY',review:'CONFIRMED'}});blocked(x,'DEATH_FACT_CONFLICT');
});
test('M2 parser rejects duplicate root, nested and escaped keys before overwrite',()=>{
  for(const text of ['{"a":1,"a":2}','{"x":{"a":1,"a":2}}','{"a":1,"\\u0061":2}'])error(()=>parseM2InputJson(text),'DUPLICATE_JSON_KEY');
  assert.deepEqual(parseM2InputJson('{"a":[true,false,null,1.5e2,"\\\"x"]}'),{a:[true,false,null,150,'"x']});
  for(const text of ['[1,]','{"a":}','true false','01','"unterminated','1e400'])error(()=>parseM2InputJson(text),text==='1e400'?'NON_JSON_INPUT':'INVALID_JSON');
});
test('M2 raw JSON size boundaries and multibyte counting',()=>{
  for(const n of [M2_LIMITS.jsonBytes-1,M2_LIMITS.jsonBytes])assert.equal(parseM2InputJson('0'+' '.repeat(n-1)),0);
  error(()=>parseM2InputJson('0'+' '.repeat(M2_LIMITS.jsonBytes)),'INPUT_LIMIT_EXCEEDED','$');
  assert.equal(parseM2InputJson(JSON.stringify('가'.repeat(1365))),'가'.repeat(1365));error(()=>parseM2InputJson(JSON.stringify('가'.repeat(1366))),'INPUT_LIMIT_EXCEEDED');
});
test('M2 object boundary rejects getters, cycles, holes, prototypes and forged flags',()=>{
  let called=false;const x=m2Input();Object.defineProperty(x,'approved',{enumerable:true,get(){called=true;return true;}});error(()=>calculateM2(x),'NON_JSON_INPUT','$.approved');assert.equal(called,false);
  const cycle=m2Input();cycle.loop=cycle;error(()=>calculateM2(cycle),'CYCLIC_JSON_OBJECT');
  for(const bad of [undefined,new Date(),[,,]])error(()=>calculateM2(bad),'NON_JSON_INPUT');
  const extra=[];extra['9999999999']=true;error(()=>calculateM2(extra),'NON_JSON_INPUT');
});
test('M2 person count boundary accepts structure at 255/256 and rejects 257',()=>{
  for(const count of [255,256,257]){const x=m2Input();while(x.persons.length<count)x.persons.push({personId:`P${x.persons.length}`});if(count>256)error(()=>calculateM2(x),'INPUT_LIMIT_EXCEEDED','persons');else assert.equal(blocked(x).checks.structure.status,'PASS');}
});
test('M2 relation count boundary is independent of legal support',()=>{
  for(const count of [511,512,513]){
    const x=m2Input();while(x.persons.length<40)x.persons.push({personId:`P${x.persons.length}`});
    const seen=new Set(x.relations.map(r=>`${r.parentId}/${r.childId}`));
    outer:for(let i=0;i<x.persons.length;i++)for(let j=i+1;j<x.persons.length;j++){
      if(x.relations.length>=count)break outer;const parentId=x.persons[i].personId,childId=x.persons[j].personId;
      if(seen.has(`${parentId}/${childId}`))continue;x.relations.push({relationId:`R${x.relations.length}`,parentId,childId,kind:'BIOLOGICAL',review:'CONFIRMED'});
    }
    if(count>512)error(()=>calculateM2(x),'INPUT_LIMIT_EXCEEDED','relations');else assert.equal(blocked(x).checks.structure.status,'PASS');
  }
});
test('M2 event count boundary is technical, not approval for 32 legal events',()=>{
  for(const count of [31,32,33]){
    const x=m2Input();for(let i=3;i<=count;i++){
      x.persons.push({personId:`P${i}`});x.deathFacts.push({deathFactId:`D${i}`,personId:`P${i}`,date:{value:'2017-01-20',precision:'DAY',review:'CONFIRMED'}});
      x.events.push({eventId:`E${i}`,decedentId:`P${i}`,deathFactId:`D${i}`,incomingRequest:{kind:'FROM_EVENT',sourceEventId:`E${i-1}`,recipientId:`P${i}`}});
    }
    if(count>32)error(()=>calculateM2(x),'INPUT_LIMIT_EXCEEDED','events');else blocked(x,'UNSUPPORTED_EVENT_COUNT');
  }
});
test('M2 node and depth limits hold at exact boundaries in the raw parser',()=>{
  assert.equal(parseM2InputJson('['+'0,'.repeat(19998)+'0]').length,19999);
  error(()=>parseM2InputJson('['+'0,'.repeat(19999)+'0]'),'INPUT_LIMIT_EXCEEDED');
  assert(Array.isArray(parseM2InputJson('['.repeat(31)+'0'+']'.repeat(31))));
  error(()=>parseM2InputJson('['.repeat(32)+'0'+']'.repeat(32)),'INPUT_LIMIT_EXCEEDED');
});
test('M2 ancillary record counts and field types are checked structurally',()=>{
  for(const [key,idKey,max] of [['deathFacts','deathFactId',256],['eventFacts','factsId',32],['historicalFamilyFacts','factId',256]]){
    const x=m2Input();x[key]=Array.from({length:max+1},(_,i)=>({[idKey]:`X${i}`}));error(()=>calculateM2(x),'INPUT_LIMIT_EXCEEDED',key);
  }
  const x=m2Input();x.events[0].lawRef.version=1;error(()=>calculateM2(x),'INVALID_FIELD_TYPE');
  const y=m2Input();y.persons={};error(()=>calculateM2(y),'INVALID_ARRAY','persons');
});
test('M2 technical ledger detects explicit event self-cycle before any legal calculation',()=>{
  const x={schemaVersion:'m2-technical-ledger-v1',material:'SYNTHETIC',rootAssetId:'ASSET',initialShare:f('1'),events:[{eventId:'TE',decedentId:'P1'}],
    acquisitions:[['X','P1'],['Y','P2']].map(([acquisitionId,personId])=>({acquisitionId,personId,eventId:'TE',assetId:'ASSET',wholeShare:f('1','2'),role:'ACTUAL'})),
    consumptions:[{sourceAcquisitionId:'X',targetEventId:'TE',assetId:'ASSET',childAcquisitionIds:['Y']}],terminalAcquisitionIds:['Y']};
  error(()=>validateM2TechnicalLedger(x),'STRUCTURAL_CYCLE','consumptions');
});
test('M2 technical ledger validates supplied arithmetic without producing a legal result',()=>{
  const x=technicalLedger(),before=structuredClone(x),r=validateM2TechnicalLedger(x);assert.equal(r.status,'TECHNICAL_VALIDATED');assert.equal(r.legalDetermination,'NOT_PERFORMED');assert.deepEqual(r.total,f('1'));assert(!('allocations' in r));assert.deepEqual(x,before);
  error(()=>calculateM2(r),'SCHEMA_VERSION_UNSUPPORTED','schemaVersion');
});
for(const [name,change,code] of [
  ['double consumption',x=>x.consumptions.push(structuredClone(x.consumptions[0])),'DUPLICATE_INFLOW_CONSUMPTION'],
  ['historical and terminal double count',x=>x.terminalAcquisitionIds.push('T1'),'HISTORICAL_TERMINAL_DOUBLE_COUNT'],
  ['hypothetical branch',x=>x.acquisitions[0].role='HYPOTHETICAL','NON_ACTUAL_ACQUISITION'],
  ['different asset',x=>x.acquisitions[0].assetId='Other','ASSET_MISMATCH'],
  ['wrong owner',x=>x.events[1].decedentId='Other','INFLOW_OWNER_MISMATCH'],
  ['event nonconservation',x=>x.acquisitions[2].wholeShare=f('1','7'),'EVENT_CONSERVATION_ERROR'],
  ['missing terminal',x=>x.terminalAcquisitionIds.pop(),'TERMINAL_CLOSURE_ERROR'],
  ['semantic acquisition alias',x=>x.acquisitions.push({...structuredClone(x.acquisitions[0]),acquisitionId:'Alias'}),'DUPLICATE_ACQUISITION']
])test(`M2 technical ledger rejects ${name}`,()=>{const x=technicalLedger();change(x);error(()=>validateM2TechnicalLedger(x),code);});
