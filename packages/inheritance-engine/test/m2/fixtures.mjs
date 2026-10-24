import { SCOPE_FACTS } from '../../src/engine.mjs';
export const fraction=(numerator,denominator='1')=>({numerator,denominator});
const absent=()=>({existence:'ABSENT_CONFIRMED',review:'CONFIRMED',complete:'CONFIRMED',members:[]});
function family(subjectId,ids) {return {subjectId,review:'CONFIRMED',complete:'CONFIRMED',spouse:absent(),children:{existence:'PRESENT',review:'CONFIRMED',complete:'CONFIRMED',memberRelationIds:ids}};}
function facts(factsId,eventId,decedentId,children,module) {
  return {factsId,eventId,review:'CONFIRMED',complete:'CONFIRMED',
    lifeStates:[{personId:decedentId,value:'DEAD_AT_OPEN',review:'CONFIRMED'},...children.map(personId=>({personId,value:'ALIVE',review:'CONFIRMED'}))],
    adultStates:children.map(personId=>({personId,value:'CONFIRMED'})),families:[],
    scopeFacts:Object.fromEntries(SCOPE_FACTS.map(key=>[key,(module==='M2_REPRESENTATION'?key==='predeceasedChildBranches':key==='successiveSuccession')?'PRESENT':'ABSENT_CONFIRMED']))};
}
// Fact-only fabricated inputs. No expected inheritance shares or approval switches.
export function m2Input(module='M2_SUCCESSIVE') {
  const x={schemaVersion:'m2-input-draft-v1',material:'SYNTHETIC',caseId:'M2Synthetic',inputRevision:'1',requestedModule:module,
    root:{assetId:'SYN-ASSET-01',decedentId:'A',initialShare:fraction('1','3'),review:'CONFIRMED'},referenceDate:{value:module==='M2_REPRESENTATION'?'2017-01-11':'2017-01-21',precision:'DAY',review:'CONFIRMED'},
    persons:['A','B','C','G1','G2'].map(personId=>({personId})),
    relations:[['AB','A','B'],['AC','A','C'],['BG1','B','G1'],['BG2','B','G2']].map(([relationId,parentId,childId])=>({relationId,parentId,childId,kind:'BIOLOGICAL',review:'CONFIRMED'})),
    deathFacts:[['DA','A','2017-01-10'],['DB','B',module==='M2_REPRESENTATION'?'2017-01-01':'2017-01-20']].map(([deathFactId,personId,value])=>({deathFactId,personId,date:{value,precision:'DAY',review:'CONFIRMED'}})),
    events:[{eventId:'E1',decedentId:'A',deathFactId:'DA',lawRef:{id:'BL1-LAW-2016-14409',version:'v1'},factsRef:'F1',incomingRequest:{kind:'ROOT_ASSET'}}],
    eventFacts:[],historicalFamilyFacts:[]};
  const f1=facts('F1','E1','A',['B','C'],module);f1.families=[family('A',['AB','AC'])];x.eventFacts.push(f1);
  if(module==='M2_REPRESENTATION') {
    f1.lifeStates[1].value='PREDECEASED';f1.lifeStates.push(...['G1','G2'].map(personId=>({personId,value:'ALIVE',review:'CONFIRMED'})));
    f1.adultStates.push(...['G1','G2'].map(personId=>({personId,value:'CONFIRMED'})));
    f1.families.push({...family('B',['BG1','BG2']),historicalSpouseFactRef:'HB'});
    x.historicalFamilyFacts.push({factId:'HB',subjectId:'B',atDeathFactId:'DB',spouse:absent()});
  } else {
    x.events.push({eventId:'E2',decedentId:'B',deathFactId:'DB',lawRef:{id:'BL1-LAW-2016-14409',version:'v1'},factsRef:'F2',incomingRequest:{kind:'FROM_EVENT',sourceEventId:'E1',recipientId:'B'}});
    const f2=facts('F2','E2','B',['G1','G2'],module);f2.families=[family('B',['BG1','BG2'])];x.eventFacts.push(f2);
  }
  return x;
}
export function technicalLedger() {
  return {schemaVersion:'m2-technical-ledger-v1',material:'SYNTHETIC',rootAssetId:'TECH-ASSET',initialShare:fraction('1'),
    events:[{eventId:'TE1',decedentId:'P0'},{eventId:'TE2',decedentId:'P1'}],
    acquisitions:[['T1','TE1','P1','1','3'],['T2','TE1','P2','2','3'],['T3','TE2','P3','1','6'],['T4','TE2','P4','1','6']].map(([acquisitionId,eventId,personId,n,d])=>({acquisitionId,eventId,personId,assetId:'TECH-ASSET',wholeShare:fraction(n,d),role:'ACTUAL'})),
    consumptions:[{sourceAcquisitionId:'T1',targetEventId:'TE2',assetId:'TECH-ASSET',childAcquisitionIds:['T3','T4']}],terminalAcquisitionIds:['T2','T3','T4']};
}
