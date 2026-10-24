import { initialShare, fraction, sum, equal, ZERO } from '../fraction.mjs';
import { deepFreeze } from '../approval.mjs';
import { captureM2Object, M2_LIMITS } from './boundary.mjs';
import { fields, id, list, fail, assertAcyclic } from './structure.mjs';

// Validates supplied fabricated arithmetic records. It NEVER creates heirs, shares or transfers.
export function validateM2TechnicalLedger(value) {
  const x=captureM2Object(value);
  fields(x,['schemaVersion','material','rootAssetId','initialShare','events','acquisitions','consumptions','terminalAcquisitionIds'],'$');
  if(x.schemaVersion!=='m2-technical-ledger-v1')fail('SCHEMA_VERSION_UNSUPPORTED','schemaVersion');
  if(x.material!=='SYNTHETIC')fail('TECHNICAL_SYNTHETIC_ONLY','material');
  id(x.rootAssetId,'rootAssetId');fields(x.initialShare,['numerator','denominator'],'initialShare');const q=initialShare(x.initialShare);
  function map(rows,key,keys,field,limit) {
    const result=new Map();
    for(const [i,row] of list(rows,field,limit).entries()) {
      fields(row,keys,`${field}[${i}]`);id(row[key],`${field}[${i}].${key}`);
      if(result.has(row[key]))fail('DUPLICATE_ID',`${field}[${i}].${key}`);result.set(row[key],row);
    }
    return result;
  }
  const events=map(x.events,'eventId',['eventId','decedentId'],'events',M2_LIMITS.events);
  for(const [key,e] of events)id(e.decedentId,`events.${key}.decedentId`);
  const acquisitions=map(x.acquisitions,'acquisitionId',['acquisitionId','eventId','personId','assetId','wholeShare','role'],'acquisitions',M2_LIMITS.relations);
  const amounts=new Map(),semantics=new Set();
  for(const [key,a] of acquisitions) {
    const at=`acquisitions.${key}`;id(a.personId,`${at}.personId`);
    if(!events.has(a.eventId))fail('BROKEN_REFERENCE',`${at}.eventId`);
    if(a.assetId!==x.rootAssetId)fail('ASSET_MISMATCH',`${at}.assetId`);
    if(a.role!=='ACTUAL')fail('NON_ACTUAL_ACQUISITION',`${at}.role`);
    fields(a.wholeShare,['numerator','denominator'],`${at}.wholeShare`);
    const amount=fraction(a.wholeShare,`${at}.wholeShare`);if(equal(amount,ZERO))fail('ZERO_ACQUISITION',`${at}.wholeShare`);amounts.set(key,amount);
    const signature=JSON.stringify([a.assetId,a.eventId,a.personId]);
    if(semantics.has(signature))fail('DUPLICATE_ACQUISITION',at);semantics.add(signature);
  }
  const consumed=new Set(),children=new Set(),edges=[];
  for(const [i,c] of list(x.consumptions,'consumptions',M2_LIMITS.relations).entries()) {
    const at=`consumptions[${i}]`;fields(c,['sourceAcquisitionId','targetEventId','assetId','childAcquisitionIds'],at);
    const source=acquisitions.get(c.sourceAcquisitionId),target=events.get(c.targetEventId);
    if(!source||!target)fail('BROKEN_REFERENCE',at);
    if(consumed.has(c.sourceAcquisitionId))fail('DUPLICATE_INFLOW_CONSUMPTION',`${at}.sourceAcquisitionId`);
    consumed.add(c.sourceAcquisitionId);
    if(c.assetId!==x.rootAssetId)fail('ASSET_MISMATCH',`${at}.assetId`);
    if(source.personId!==target.decedentId)fail('INFLOW_OWNER_MISMATCH',at);
    edges.push([source.eventId,c.targetEventId]);
    const recipients=list(c.childAcquisitionIds,`${at}.childAcquisitionIds`,M2_LIMITS.relations);
    if(!recipients.length)fail('MISSING_CHILD_ACQUISITIONS',at);
    for(const key of recipients) {
      if(!acquisitions.has(key))fail('BROKEN_REFERENCE',`${at}.childAcquisitionIds`);
      if(children.has(key))fail('DUPLICATE_INFLOW_CONSUMPTION',`${at}.childAcquisitionIds`);children.add(key);
      if(acquisitions.get(key).eventId!==c.targetEventId)fail('ACQUISITION_EVENT_MISMATCH',at);
    }
    if(!equal(sum(recipients.map(key=>amounts.get(key))),amounts.get(c.sourceAcquisitionId)))fail('EVENT_CONSERVATION_ERROR',at);
  }
  assertAcyclic([...events.keys()],edges,'consumptions');
  const terminal=list(x.terminalAcquisitionIds,'terminalAcquisitionIds',M2_LIMITS.relations),seen=new Set();
  for(const key of terminal) {
    if(!acquisitions.has(key))fail('BROKEN_REFERENCE','terminalAcquisitionIds');
    if(seen.has(key))fail('DUPLICATE_REFERENCE','terminalAcquisitionIds');seen.add(key);
    if(consumed.has(key))fail('HISTORICAL_TERMINAL_DOUBLE_COUNT','terminalAcquisitionIds');
  }
  const expected=[...acquisitions.keys()].filter(key=>!consumed.has(key));
  if(expected.length!==terminal.length||expected.some(key=>!seen.has(key)))fail('TERMINAL_CLOSURE_ERROR','terminalAcquisitionIds');
  const roots=[...acquisitions.keys()].filter(key=>!children.has(key));
  if(new Set(roots.map(key=>acquisitions.get(key).eventId)).size!==1)fail('ROOT_EVENT_MISMATCH','acquisitions');
  if(!equal(sum(roots.map(key=>amounts.get(key))),q))fail('ROOT_CONSERVATION_ERROR','acquisitions');
  const total=sum(terminal.map(key=>amounts.get(key)));
  if(!equal(total,q))fail('TERMINAL_CONSERVATION_ERROR','terminalAcquisitionIds');
  return deepFreeze({status:'TECHNICAL_VALIDATED',legalDetermination:'NOT_PERFORMED',
    warnings:['SYNTHETIC_ARITHMETIC_RECORDS_ONLY','NO_LEGAL_CAPACITY_DETERMINATION'],
    checks:{eventConservation:true,consumptionIdentity:true,terminalClosure:true,rootConservation:true},total,expected:q});
}
