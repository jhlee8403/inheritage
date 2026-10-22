import { SCOPE_FACTS, LAW_ID } from './engine-adapter.mjs';
const collection = members => ({existence: members.length ? 'PRESENT' : 'ABSENT_CONFIRMED', review:'CONFIRMED', complete:'CONFIRMED', members});
const person = (id, relation) => ({id, relation, kind:relation === 'SPOUSE' ? 'LEGAL_MARRIAGE' : 'BIOLOGICAL', life:'ALIVE', adult:'CONFIRMED', review:'CONFIRMED', relationshipReview:'CONFIRMED'});
// Input-only, fully fabricated fixtures. No expected shares or result lookup table.
export function sample(type) {
  return {
    schemaVersion:'c1-v1', material:'SYNTHETIC', caseId:'SyntheticManual', inputRevision:'1', lawSnapshotId:LAW_ID,
    asset:{id:'SyntheticAsset', share:{numerator:'1',denominator:'1'}, review:'CONFIRMED'},
    referenceDate:{value:'2017-01-11', review:'CONFIRMED'},
    event:{id:'E1', decedentId:'A', kind:'SINGLE', deathOrder:'CONFIRMED', openingDate:{value:'2017-01-10',precision:'DAY',review:'CONFIRMED'}},
    family:{review:'CONFIRMED',complete:'CONFIRMED',
      spouse:collection(type === 'children' ? [] : [person('W','SPOUSE')]),
      children:collection(type === 'parents' ? [] : (type === 'children' ? ['C1','C2','C3'] : ['C1','C2']).map(id=>person(id,'CHILD'))),
      parents:collection(type === 'parents' ? [person('F','PARENT'),person('M','PARENT')] : []), remoteRelatives:collection([])},
    scopeFacts:Object.fromEntries(SCOPE_FACTS.map(key=>[key,'ABSENT_CONFIRMED']))
  };
}
export function blank() {
  const input=sample('children');
  input.asset.share={numerator:'',denominator:''};
  input.asset.review=input.referenceDate.review=input.event.deathOrder=input.event.openingDate.review='UNKNOWN';
  input.family.review=input.family.complete='UNKNOWN';
  for(const key of ['spouse','children','parents','remoteRelatives']) input.family[key]={existence:'UNKNOWN',review:'UNKNOWN',complete:'UNKNOWN',members:[]};
  for(const key of SCOPE_FACTS) input.scopeFacts[key]='UNKNOWN';
  return input;
}
export function blankPerson(relation) {
  return {id:'',relation,kind:relation==='SPOUSE'?'LEGAL_MARRIAGE':'BIOLOGICAL',life:'UNKNOWN',adult:'UNKNOWN',review:'UNKNOWN',relationshipReview:'UNKNOWN'};
}
