import { InputError } from '../fraction.mjs';
import { M2_LIMITS } from './boundary.mjs';
import { SCOPE_FACTS } from '../engine.mjs';
export { SCOPE_FACTS };
export const fail=(code,field)=>{throw new InputError(code,field);};
export function object(value,field) { if(!value || typeof value!=='object' || Array.isArray(value))fail('INVALID_OBJECT',field);return value; }
export function fields(value,keys,field) {
  object(value,field);
  for(const key of Object.keys(value))if(!keys.includes(key))fail('UNSUPPORTED_INPUT_FIELD',`${field}.${key}`);
}
export function id(value,field) { if(typeof value!=='string'||!/^[A-Za-z0-9_-]{1,100}$/.test(value))fail('INVALID_ID',field);return value; }
function strings(o,keys,field) { for(const key of keys)if(o[key]!=null&&typeof o[key]!=='string')fail('INVALID_FIELD_TYPE',`${field}.${key}`); }
export function list(value,field,limit=20000) {
  if(!Array.isArray(value))fail('INVALID_ARRAY',field);
  if(value.length>limit)fail('INPUT_LIMIT_EXCEEDED',field);return value;
}
function unique(values,field) { if(new Set(values).size!==values.length)fail('DUPLICATE_REFERENCE',field); }
function table(rows,key,keys,field,limit) {
  const map=new Map();
  for(const [i,row] of list(rows,field,limit).entries()) {
    fields(row,keys,`${field}[${i}]`);const name=id(row[key],`${field}[${i}].${key}`);
    if(map.has(name))fail('DUPLICATE_ID',`${field}[${i}].${key}`);map.set(name,row);
  }
  return map;
}
function ref(map,value,field) {id(value,field);if(!map.has(value))fail('BROKEN_REFERENCE',field);return map.get(value);}
export function assertAcyclic(ids,edges,field) {
  const degree=new Map(ids.map(i=>[i,0])),next=new Map(ids.map(i=>[i,[]]));
  for(const [a,b] of edges){degree.set(b,degree.get(b)+1);next.get(a).push(b);}
  const queue=ids.filter(i=>degree.get(i)===0);let visited=0;
  for(let i=0;i<queue.length;i++) {visited++;for(const b of next.get(queue[i])){degree.set(b,degree.get(b)-1);if(degree.get(b)===0)queue.push(b);}}
  if(visited!==ids.length)fail('STRUCTURAL_CYCLE',field);
}
function dateShape(value,field) {
  if(value==null)return;
  fields(value,['value','precision','review'],field);strings(value,['value','precision','review'],field);
}
function collection(c,field,memberKey,map) {
  if(c==null)return;
  fields(c,['existence','review','complete',memberKey],field);strings(c,['existence','review','complete'],field);
  if(c.existence!=null&&!['UNKNOWN','PRESENT','ABSENT_CONFIRMED'].includes(c.existence))fail('INVALID_EXISTENCE_STATE',`${field}.existence`);
  if(c[memberKey]!=null) {
    const members=list(c[memberKey],`${field}.${memberKey}`);unique(members,`${field}.${memberKey}`);
    members.forEach((value,i)=>ref(map,value,`${field}.${memberKey}[${i}]`));
    if((c.existence==='ABSENT_CONFIRMED'&&members.length)||(c.existence==='PRESENT'&&!members.length))fail('CONTRADICTORY_COLLECTION',field);
  }
}

// Only graph identity/shape. No heir selection, branches, inheritance arithmetic or event transfers.
export function inspectStructure(input) {
  fields(input,['schemaVersion','material','caseId','inputRevision','requestedModule','root','referenceDate','persons','relations','deathFacts','events','eventFacts','historicalFamilyFacts','truthReference'],'$');
  if(input.schemaVersion!=='m2-input-draft-v1')fail('SCHEMA_VERSION_UNSUPPORTED','schemaVersion');
  strings(input,['material','requestedModule'],'$');id(input.caseId,'caseId');id(input.inputRevision,'inputRevision');
  fields(input.root,['assetId','decedentId','initialShare','review'],'root');
  id(input.root.assetId,'root.assetId');strings(input.root,['review'],'root');
  fields(input.root.initialShare,['numerator','denominator'],'root.initialShare');
  dateShape(input.referenceDate,'referenceDate');
  if(input.truthReference!=null) {
    fields(input.truthReference,['id','version'],'truthReference');id(input.truthReference.id,'truthReference.id');id(input.truthReference.version,'truthReference.version');
  }
  const persons=table(input.persons,'personId',['personId'],'persons',M2_LIMITS.persons);
  ref(persons,input.root.decedentId,'root.decedentId');
  const relations=table(input.relations,'relationId',['relationId','parentId','childId','kind','review'],'relations',M2_LIMITS.relations);
  const relationEdges=[],seenRelations=new Set();
  for(const [key,r] of relations) {
    const field=`relations.${key}`;strings(r,['kind','review'],field);
    ref(persons,r.parentId,`${field}.parentId`);ref(persons,r.childId,`${field}.childId`);
    const semantic=JSON.stringify([r.parentId,r.childId]);if(seenRelations.has(semantic))fail('DUPLICATE_RELATIONSHIP',field);
    seenRelations.add(semantic);relationEdges.push([r.parentId,r.childId]);
  }
  assertAcyclic([...persons.keys()],relationEdges,'relations');
  const deaths=table(input.deathFacts,'deathFactId',['deathFactId','personId','date'],'deathFacts',M2_LIMITS.deathFacts);
  for(const [key,d] of deaths){ref(persons,d.personId,`deathFacts.${key}.personId`);dateShape(d.date,`deathFacts.${key}.date`);}
  const events=table(input.events,'eventId',['eventId','decedentId','deathFactId','lawRef','factsRef','incomingRequest'],'events',M2_LIMITS.events);
  if(!events.size)fail('MISSING_EVENTS','events');
  const facts=table(input.eventFacts??[],'factsId',['factsId','eventId','review','complete','lifeStates','adultStates','families','scopeFacts'],'eventFacts',M2_LIMITS.eventFacts);
  const historical=table(input.historicalFamilyFacts??[],'factId',['factId','subjectId','atDeathFactId','spouse'],'historicalFamilyFacts',M2_LIMITS.historicalFamilyFacts);
  const edges=[],inflows=new Set();let roots=0;
  for(const [key,e] of events) {
    const field=`events.${key}`;ref(persons,e.decedentId,`${field}.decedentId`);
    const death=ref(deaths,e.deathFactId,`${field}.deathFactId`);
    if(death.personId!==e.decedentId)fail('EVENT_SUBJECT_MISMATCH',`${field}.deathFactId`);
    if(e.lawRef!=null){fields(e.lawRef,['id','version'],`${field}.lawRef`);strings(e.lawRef,['id','version'],`${field}.lawRef`);}
    if(e.factsRef!=null){const f=ref(facts,e.factsRef,`${field}.factsRef`);if(f.eventId!==key)fail('FACT_EVENT_MISMATCH',`${field}.factsRef`);}
    fields(e.incomingRequest,['kind','sourceEventId','recipientId'],`${field}.incomingRequest`);strings(e.incomingRequest,['kind'],`${field}.incomingRequest`);
    const incoming=e.incomingRequest;
    if(incoming.kind==='ROOT_ASSET') {
      roots++;
      if(e.decedentId!==input.root.decedentId || incoming.sourceEventId!=null || incoming.recipientId!=null)fail('ROOT_EVENT_MISMATCH',`${field}.incomingRequest`);
    } else if(incoming.kind==='FROM_EVENT') {
      ref(events,incoming.sourceEventId,`${field}.incomingRequest.sourceEventId`);ref(persons,incoming.recipientId,`${field}.incomingRequest.recipientId`);
      const semantic=JSON.stringify([input.root.assetId,incoming.sourceEventId,incoming.recipientId]);
      if(inflows.has(semantic))fail('DUPLICATE_INFLOW_CONSUMPTION',`${field}.incomingRequest`);
      inflows.add(semantic);edges.push([incoming.sourceEventId,key]);
    } else fail('INVALID_INCOMING_KIND',`${field}.incomingRequest.kind`);
  }
  assertAcyclic([...events.keys()],edges,'events');
  if(roots!==1)fail('INVALID_ROOT_EVENT_COUNT','events');
  for(const [key,e] of events)if(e.incomingRequest.kind==='FROM_EVENT'&&e.incomingRequest.recipientId!==e.decedentId)fail('INFLOW_OWNER_MISMATCH',`events.${key}.incomingRequest.recipientId`);
  for(const [key,h] of historical) {
    const field=`historicalFamilyFacts.${key}`;ref(persons,h.subjectId,`${field}.subjectId`);
    const d=ref(deaths,h.atDeathFactId,`${field}.atDeathFactId`);if(d.personId!==h.subjectId)fail('HISTORY_SUBJECT_MISMATCH',field);
    collection(h.spouse,`${field}.spouse`,'members',persons);
  }
  for(const [key,f] of facts) {
    const field=`eventFacts.${key}`;ref(events,f.eventId,`${field}.eventId`);strings(f,['review','complete'],field);
    for(const name of ['lifeStates','adultStates'])if(f[name]!=null) {
      const states=list(f[name],`${field}.${name}`);const seen=new Set();
      for(const [i,s] of states.entries()) {
        const at=`${field}.${name}[${i}]`;fields(s,['personId','value','review'],at);ref(persons,s.personId,`${at}.personId`);strings(s,['value','review'],at);
        if(seen.has(s.personId))fail('DUPLICATE_REFERENCE',`${at}.personId`);seen.add(s.personId);
      }
    }
    if(f.scopeFacts!=null){fields(f.scopeFacts,SCOPE_FACTS,`${field}.scopeFacts`);strings(f.scopeFacts,SCOPE_FACTS,`${field}.scopeFacts`);}
    if(f.families!=null) {
      const seen=new Set();
      for(const [i,family] of list(f.families,`${field}.families`).entries()) {
        const at=`${field}.families[${i}]`;fields(family,['subjectId','review','complete','spouse','children','historicalSpouseFactRef'],at);
        ref(persons,family.subjectId,`${at}.subjectId`);strings(family,['review','complete'],at);
        if(seen.has(family.subjectId))fail('DUPLICATE_REFERENCE',`${at}.subjectId`);seen.add(family.subjectId);
        collection(family.spouse,`${at}.spouse`,'members',persons);collection(family.children,`${at}.children`,'memberRelationIds',relations);
        for(const rel of family.children?.memberRelationIds??[])if(relations.get(rel).parentId!==family.subjectId)fail('RELATIONSHIP_SUBJECT_MISMATCH',`${at}.children.memberRelationIds`);
        if(family.historicalSpouseFactRef!=null) {
          const h=ref(historical,family.historicalSpouseFactRef,`${at}.historicalSpouseFactRef`);
          if(h.subjectId!==family.subjectId)fail('HISTORY_SUBJECT_MISMATCH',`${at}.historicalSpouseFactRef`);
        }
      }
    }
  }
  return {persons,relations,deaths,events,facts,historical,edges};
}
