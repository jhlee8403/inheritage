import { initialShare, ZERO, ONE, sum, equal } from '../fraction.mjs';
import { deepFreeze, APPROVALS } from '../approval.mjs';
import { captureM2Object, parseM2InputJson } from './boundary.mjs';
import { inspectStructure, object, fail, SCOPE_FACTS } from './structure.mjs';

export const M2_VERSION='m2-validation-0.1.0';
export const M2_POLICY=deepFreeze({version:'M2-safety-policy-v1',rules:{'BL1-R04':'PENDING','BL1-R05':'PENDING'},bindings:[]});
function diagnostics(input,graph) {
  const reasons=[];
  const block=(code,field,extra={})=>reasons.push({code,field,...extra});
  const confirmed=(value,field)=>{if(value!=='CONFIRMED')block('FACT_UNCONFIRMED',field);};
  function day(value,field) {
    if(value?.review!=='CONFIRMED'||value?.precision!=='DAY'||value?.value==null){block('DATE_UNCONFIRMED',field);return null;}
    const v=value.value;
    const parsed=/^\d{4}-\d{2}-\d{2}$/.test(v)?Date.parse(`${v}T00:00:00Z`):NaN;
    if(!Number.isFinite(parsed)||new Date(parsed).toISOString().slice(0,10)!==v)fail('INVALID_DATE',field);
    return v;
  }
  if(input.material!=='SYNTHETIC')block('SYNTHETIC_ONLY','material');
  confirmed(input.root.review,'root.review');
  const reference=day(input.referenceDate,'referenceDate'),dates=new Map();
  for(const [key,d] of graph.deaths)dates.set(key,day(d.date,`deathFacts.${key}.date`));
  const personDeaths=new Map();
  for(const [key,d] of graph.deaths)if(dates.get(key)) {
    if(personDeaths.has(d.personId)&&personDeaths.get(d.personId)!==dates.get(key))block('DEATH_FACT_CONFLICT',`deathFacts.${key}`);
    personDeaths.set(d.personId,dates.get(key));
  }
  const representation=input.requestedModule==='M2_REPRESENTATION';
  if(!representation&&input.requestedModule!=='M2_SUCCESSIVE')block('UNSUPPORTED_MODULE','requestedModule');
  if(graph.events.size!==(representation?1:2))block('UNSUPPORTED_EVENT_COUNT','events');
  for(const [key,r] of graph.relations) {
    confirmed(r.review,`relations.${key}.review`);
    if(r.kind!=='BIOLOGICAL')block('UNSUPPORTED_RELATIONSHIP',`relations.${key}.kind`);
  }
  function complete(c,field,memberKey) {
    if(!c){block('FACTS_INCOMPLETE',field);return;}
    if(c.existence==null||c.existence==='UNKNOWN')block('EXISTENCE_UNKNOWN',`${field}.existence`);
    confirmed(c.review,`${field}.review`);confirmed(c.complete,`${field}.complete`);
    if(!Array.isArray(c[memberKey]))block('FACTS_INCOMPLETE',`${field}.${memberKey}`);
  }
  for(const [key,e] of graph.events) {
    const field=`events.${key}`,date=dates.get(e.deathFactId);
    if(reference&&date&&date>reference)block('FUTURE_EVENT_POLICY_PENDING',field,{eventId:key});
    if(e.incomingRequest.kind==='FROM_EVENT') {
      const source=graph.events.get(e.incomingRequest.sourceEventId),previous=dates.get(source.deathFactId);
      if(!previous||!date)block('DEATH_ORDER_UNKNOWN',field,{eventId:key});
      else if(previous>=date)block('EVENT_ORDER_CONFLICT',field,{eventId:key});
    }
    if(!e.lawRef?.id||!e.lawRef?.version)block('LAW_UNCONFIRMED',`${field}.lawRef`,{eventId:key});
    const f=e.factsRef?graph.facts.get(e.factsRef):null;
    if(!f){block('FACTS_INCOMPLETE',`${field}.factsRef`);continue;}
    const at=`eventFacts.${f.factsId}`;
    confirmed(f.review,`${at}.review`);confirmed(f.complete,`${at}.complete`);
    const needed=new Set([e.decedentId]);
    const families=f.families??[];
    if(!families.some(family=>family.subjectId===e.decedentId))block('FACTS_INCOMPLETE',`${at}.families`);
    for(const family of families) {
      const path=`${at}.families.${family.subjectId}`;
      confirmed(family.review,`${path}.review`);confirmed(family.complete,`${path}.complete`);
      complete(family.spouse,`${path}.spouse`,'members');complete(family.children,`${path}.children`,'memberRelationIds');
      if(family.spouse?.existence==='PRESENT')block('UNSUPPORTED_SCOPE',`${path}.spouse`);
      for(const relation of family.children?.memberRelationIds??[])needed.add(graph.relations.get(relation).childId);
      if(family.children?.complete==='CONFIRMED'&&Array.isArray(family.children.memberRelationIds)) {
        for(const r of graph.relations.values())if(r.parentId===family.subjectId&&!family.children.memberRelationIds.includes(r.relationId))block('FACTS_CONFLICTED',`${path}.children`);
      }
    }
    for(const person of needed) {
      const state=f.lifeStates?.find(s=>s.personId===person);
      if(!state||state.review!=='CONFIRMED'||!['ALIVE','PREDECEASED','DEAD_AT_OPEN'].includes(state.value))block('LIFE_STATUS_UNKNOWN',`${at}.lifeStates.${person}`);
      if(person===e.decedentId&&state?.value!=='DEAD_AT_OPEN')block('LIFE_STATUS_CONFLICT',`${at}.lifeStates.${person}`);
      if(person!==e.decedentId&&state?.value==='DEAD_AT_OPEN')block('LIFE_STATUS_CONFLICT',`${at}.lifeStates.${person}`);
      const knownDeath=personDeaths.get(person);
      if(date&&knownDeath&&state?.review==='CONFIRMED'&&((state.value==='ALIVE'&&knownDeath<=date)||(state.value==='PREDECEASED'&&knownDeath>=date)))block('LIFE_DATE_CONFLICT',`${at}.lifeStates.${person}`);
      if(person!==e.decedentId&&(!f.adultStates?.some(s=>s.personId===person&&s.value==='CONFIRMED'&&(s.review==null||s.review==='CONFIRMED'))))block('ADULT_STATUS_UNKNOWN',`${at}.adultStates.${person}`);
      if(representation&&state?.value==='PREDECEASED') {
        const family=families.find(family=>family.subjectId===person);
        if(!family)block('FACTS_INCOMPLETE',`${at}.families.${person}`);
        const h=family?.historicalSpouseFactRef?graph.historical.get(family.historicalSpouseFactRef):null;
        if(!h)block('HISTORICAL_FACT_UNCONFIRMED',`${at}.families.${person}.historicalSpouseFactRef`);
        else complete(h.spouse,`historicalFamilyFacts.${h.factId}.spouse`,'members');
      }
    }
    for(const name of SCOPE_FACTS) {
      const expected=(representation&&name==='predeceasedChildBranches')||(!representation&&name==='successiveSuccession')?'PRESENT':'ABSENT_CONFIRMED';
      const value=f.scopeFacts?.[name];
      if(value==null||value==='UNKNOWN')block('SCOPE_UNCONFIRMED',`${at}.scopeFacts.${name}`);
      else if(value!==expected)block('UNSUPPORTED_SCOPE',`${at}.scopeFacts.${name}`);
    }
  }
  return reasons;
}

// Deliberately no approval-context parameter and no successful distribution branch.
export function calculateM2(input) {
  if(arguments.length!==1)fail('APPROVAL_OVERRIDE_FORBIDDEN','arguments');
  const captured=captureM2Object(input);
  object(captured,'$');
  if(captured.schemaVersion!=='m2-input-draft-v1')fail('SCHEMA_VERSION_UNSUPPORTED','schemaVersion');
  object(captured.root,'root');
  const q=initialShare(captured.root.initialShare);
  const graph=inspectStructure(captured);
  const facts=diagnostics(captured,graph);
  const ruleId=captured.requestedModule==='M2_REPRESENTATION'?'BL1-R04':captured.requestedModule==='M2_SUCCESSIVE'?'BL1-R05':null;
  const reasons=[...facts];
  if(ruleId)reasons.push({code:'RULE_PENDING',field:'requestedModule',ruleId});
  for(const e of graph.events.values()) {
    reasons.push({code:'LAW_SCOPE_PENDING',field:`events.${e.eventId}.lawRef`,eventId:e.eventId});
    reasons.push({code:'DATE_SCOPE_PENDING',field:'referenceDate',eventId:e.eventId});
    for(const id of ['BL1-G00','BL1-R03','BL1-R06','BL1-R07'])reasons.push({code:'DEPENDENCY_SCOPE_PENDING',field:`events.${e.eventId}`,eventId:e.eventId,ruleId:id});
  }
  if(captured.truthReference)reasons.push({code:'TRUTH_PENDING',field:'truthReference'});
  const conserved=equal(sum([ZERO,q]),q);
  return deepFreeze({schemaVersion:'m2-result-draft-v1',contractVersion:'M2-contract-draft-v1',
    caseId:captured.caseId,inputRevision:captured.inputRevision,status:'BLOCKED',legalDetermination:'NOT_PERFORMED',
    rootAssetId:captured.root.assetId,initialShare:q,referenceDate:captured.referenceDate?.value??null,
    eventResults:[...graph.events.keys()].map(eventId=>({eventId,status:'NOT_EVALUATED'})),
    branchBases:[],eventInputs:[],acquisitions:[],consumptions:[],paths:[],allocations:[],auditHistory:[],
    unresolved:[{id:'ROOT-UNRESOLVED',rootAssetId:captured.root.assetId,rootRelativeShare:ONE,wholeShare:q}],blockedReasons:reasons,
    warnings:['SYNTHETIC_ONLY','STATUTORY_SHARE_ONLY','NOT_A_RIGHTS_DETERMINATION','UNRESOLVED_IS_NOT_ZERO_LEGAL_SHARE'],
    provenance:{safetyFoundationVersion:M2_VERSION,policyVersion:M2_POLICY.version,c1ApprovalRecordVersion:APPROVALS.recordVersion,
      ruleStates:M2_POLICY.rules,requestedRules:ruleId?[{id:ruleId,version:'v1'}]:[],appliedRules:[],
      requestedLawRefs:[...graph.events.values()].map(e=>({eventId:e.eventId,lawRef:e.lawRef??null})),
      truthReference:captured.truthReference??null,approvalBindingsApplied:[]},
    checks:{inputBoundary:{status:'PASS'},structure:{status:'PASS'},facts:{status:facts.length?'INCOMPLETE':'COMPLETE'},
      approval:{status:'BLOCKED'},rootConservation:{ok:conserved,allocated:ZERO,unresolved:q,total:q,expected:q},
      legalAllocation:{status:'NOT_RUN'},eventConservation:{status:'NOT_RUN'},pathIdentity:{status:'NOT_RUN'}}});
}
export function calculateM2Json(text) { return calculateM2(parseM2InputJson(text)); }
