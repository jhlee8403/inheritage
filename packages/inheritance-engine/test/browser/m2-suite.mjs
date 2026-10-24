import * as api from '../../src/m2.mjs';
import { m2Input,technicalLedger } from '../m2/fixtures.mjs';
export async function runM2Checks() {
  const results=[];
  const assert=(v,message)=>{if(!v)throw new Error(message);};
  const blocked=(input,code)=>{const r=api.calculateM2(input);assert(r.status==='BLOCKED'&&r.allocations.length===0&&r.paths.length===0,'not blocked');assert(r.unresolved.length===1&&r.unresolved[0].wholeShare.denominator==='3','Q not preserved');assert(r.blockedReasons.some(b=>b.code===code),code);return r;};
  const error=(fn,code)=>{try{fn();}catch(e){assert(e instanceof api.InputError&&e.code===code,`${e.code} != ${code}`);return;}throw new Error('expected '+code);};
  const check=async(name,fn)=>{try{await fn();results.push({name,pass:true});}catch(e){results.push({name,pass:false,error:e.stack});}};
  await check('separate public M2 browser module imports',()=>assert(typeof api.calculateM2==='function'&&typeof api.parseM2InputJson==='function'&&!('calculate' in api),'entry'));
  for(const module of ['M2_REPRESENTATION','M2_SUCCESSIVE'])await check(`${module} complete facts remain pending`,()=>{const r=blocked(m2Input(module),'RULE_PENDING');assert(r.checks.facts.status==='COMPLETE','facts stage');assert(r.checks.legalAllocation.status==='NOT_RUN','legal stage');});
  await check('raw duplicate escaped keys reject before overwrite',()=>error(()=>api.parseM2InputJson('{"a":1,"\\u0061":2}'),'DUPLICATE_JSON_KEY'));
  await check('invalid Q is InputError, no fake unresolved',()=>{const x=m2Input();x.root.initialShare.denominator='0';error(()=>api.calculateM2(x),'NONPOSITIVE_DENOMINATOR');});
  await check('missing facts record differs from incomplete facts',()=>{const x=m2Input();delete x.eventFacts[0].families;blocked(x,'FACTS_INCOMPLETE');x.eventFacts=[];error(()=>api.calculateM2(x),'BROKEN_REFERENCE');});
  await check('truth omission/forgery and injected approval cannot bypass',()=>{const x=m2Input();blocked(x,'RULE_PENDING');x.truthReference={id:'Forged',version:'APPROVED'};blocked(x,'RULE_PENDING');x.events[0].lawRef.proof='fake';error(()=>api.calculateM2(x),'UNSUPPORTED_INPUT_FIELD');});
  await check('cycles and technical double consumption reject',()=>{const x=m2Input();x.relations.push({relationId:'Back',parentId:'G1',childId:'A',kind:'BIOLOGICAL',review:'CONFIRMED'});error(()=>api.calculateM2(x),'STRUCTURAL_CYCLE');const l=technicalLedger();assert(api.validateM2TechnicalLedger(l).status==='TECHNICAL_VALIDATED','technical only');l.consumptions.push({...l.consumptions[0]});error(()=>api.validateM2TechnicalLedger(l),'DUPLICATE_INFLOW_CONSUMPTION');});
  await check('future E2 policy is not activated',()=>{const x=m2Input();x.referenceDate.value='2017-01-15';const r=blocked(x,'FUTURE_EVENT_POLICY_PENDING');assert(r.eventResults.every(e=>e.status==='NOT_EVALUATED'),'future not approved');});
  return {results,pass:results.filter(r=>r.pass).length,fail:results.filter(r=>!r.pass).length,skipped:0};
}
