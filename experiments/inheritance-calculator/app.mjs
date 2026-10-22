import * as api from './engine-adapter.mjs';
import { sample, blank, blankPerson } from './fixtures.mjs';
import { CalculationSession } from './session.mjs';
const $=id=>document.getElementById(id);
const reviews=['UNKNOWN','CONFIRMED'];
const existence=['UNKNOWN','PRESENT','ABSENT_CONFIRMED'];
const groups={spouse:['배우자','SPOUSE'],children:['자녀','CHILD'],parents:['부모','PARENT'],remoteRelatives:['먼 혈족 (비선택 확인용)','GRANDCHILD']};
let input=blank(), revision=0;
const fraction=f=>`${f.numerator}/${f.denominator}`;
function resultText(state) {
  const r=state.result;
  const lines=['가공 사례 검증용 / 지원 범위 제한 / 실제 사건 사용 불가',`상태: ${r.status}`,`사건: ${r.eventId} / 입력 revision: ${r.provenance.inputRevision}`,`시작 지분 Q: ${fraction(r.initialShare)}`];
  if(r.status==='BLOCKED') lines.push('계산 차단 — 확정 배분 결과가 아닙니다. 각 사람의 법률상 지분 0을 의미하지 않습니다.',...r.blockedReasons.map(b=>`${b.code}: ${b.field}`));
  else {
    lines.push('가공 검토 결과 (실제 권리 확정 아님)', '인물 | 상대분 | 물건 전체분 | 취득 경로');
    for(const a of r.allocations) lines.push(`${a.personId} | ${fraction(a.relativeShare)} | ${fraction(a.wholeShare)} | ${a.pathIds.join(', ')}`);
  }
  for(const u of r.unresolved) lines.push(`미해결 Q: ${fraction(u.wholeShare)} / ${u.id}`);
  lines.push(`적용 규칙: ${r.provenance.appliedRules.map(rule=>`${rule.id}@${rule.version}`).join(', ')}`,`경고: ${r.warnings.join(', ')}`,`SHA-256: ${state.hash}`,'','전체 경로·미해결·provenance·검산 (JSON)',JSON.stringify(r,null,2));
  return lines.join('\n');
}
function publish(state) {
  $('status').textContent=`${state.status}${state.message ? ' · '+state.message : ''}`;
  $('status').dataset.state=state.status;
  const ready=!!state.result;
  $('output').value=ready ? resultText(state) : '';
  $('output').setSelectionRange(0,0);
  $('output').scrollTop=0;
  $('output').hidden=!ready;
  $('copy').disabled=$('select').disabled=!ready;
  $('copy-note').textContent='';
}
const session=new CalculationSession(api,publish);
function changed() {
  input.inputRevision=String(++revision);
  // A manually edited fixture is no longer claimed to be its original truth input.
  delete input.truthReference;
  session.invalidate(input);
}
function at(path) { return path.split('.').reduce((value,key)=>value[key],input); }
function set(path,value) {const parts=path.split('.'),key=parts.pop();parts.reduce((value,p)=>value[p],input)[key]=value;}
function node(tag,text) {const element=document.createElement(tag);if(text!==undefined)element.textContent=text;return element;}
function field(parent,title,path,options) {
  const label=node('label',title),control=node(options?'select':'input');
  control.dataset.field=path;control.setAttribute('aria-label',title);
  if(options) for(const value of options){const option=node('option',value);option.value=value;control.append(option);}
  else {control.type='text';control.spellcheck=false;control.maxLength=1100;}
  control.value=at(path) ?? '';
  control.addEventListener(options?'change':'input',()=>{set(path,control.value);changed();});
  label.append(control);parent.append(label);
}
function fields(parent) {const row=node('div');row.className='fields';parent.append(row);return row;}
function render() {
  const form=$('facts');form.replaceChildren();
  const general=fields(form);
  field(general,'가공 사건 ID','caseId');field(general,'피상속인 ID','event.decedentId');
  field(general,'Q 분자 (정수 문자열)','asset.share.numerator');field(general,'Q 분모 (양의 정수 문자열)','asset.share.denominator');
  const confirmations=node('fieldset');confirmations.append(node('legend','공통 사실 확인'));form.append(confirmations);
  const common=fields(confirmations);
  for(const [title,path] of [['물건 지분 확인','asset.review'],['개시일 확인','event.openingDate.review'],['기준일 확인','referenceDate.review'],['사망 선후 확인','event.deathOrder'],['가족 사실 확인','family.review'],['가족 집합 완전성','family.complete']]) field(common,title,path,reviews);
  for(const [key,[title,relation]] of Object.entries(groups)) {
    const box=node('fieldset');box.append(node('legend',title));form.append(box);
    const row=fields(box),base=`family.${key}`;
    field(row,`${title} 존재 상태`,`${base}.existence`,existence);
    field(row,`${title} 사실 확인`,`${base}.review`,reviews);field(row,`${title} 집합 완전성`,`${base}.complete`,reviews);
    input.family[key].members.forEach((person,index)=>{
      const card=node('div');card.className='person';box.append(card);const row=fields(card),path=`${base}.members.${index}`;
      field(row,'가공 인물 ID',`${path}.id`);
      if(key==='remoteRelatives') {field(row,'먼 혈족 관계',`${path}.relation`,['GRANDCHILD','GRANDPARENT']);field(row,'연결 인물 viaId',`${path}.viaId`);}
      field(row,'생존 상태',`${path}.life`,['UNKNOWN','ALIVE','PREDECEASED']);
      field(row,'성년 확인',`${path}.adult`,reviews);field(row,'인물 사실 확인',`${path}.review`,reviews);field(row,'관계 확인',`${path}.relationshipReview`,reviews);
      const remove=node('button','인물 삭제');remove.type='button';remove.dataset.remove=`${key}:${index}`;
      remove.addEventListener('click',()=>{input.family[key].members.splice(index,1);input.family[key].complete='UNKNOWN';changed();render();});card.append(remove);
    });
    const add=node('button',`${title} 인물 추가`);add.type='button';add.dataset.add=key;
    add.addEventListener('click',()=>{const person=blankPerson(relation);if(key==='remoteRelatives')person.viaId='';input.family[key].members.push(person);input.family[key].complete='UNKNOWN';changed();render();});box.append(add);
  }
  const details=node('details');details.append(node('summary','미지원 쟁점 확인 (모두 부존재 확인이 필요)'));form.append(details);
  const scope=fields(details);for(const key of api.SCOPE_FACTS) field(scope,key,`scopeFacts.${key}`,existence);
}
$('facts').addEventListener('submit',event=>event.preventDefault());
for(const button of document.querySelectorAll('[data-sample]')) button.addEventListener('click',()=>{input=sample(button.dataset.sample);changed();render();});
$('blank').addEventListener('click',()=>{input=blank();changed();render();});
$('calculate').addEventListener('click',()=>void session.calculate(input));
$('cancel').addEventListener('click',()=>session.cancel());
$('select').addEventListener('click',()=>{if(session.canCopy()){$('output').focus();$('output').select();}});
$('copy').addEventListener('click',async()=>{
  if(!session.canCopy())return;
  const request=session.request,rev=session.revision,text=$('output').value;
  $('copy').disabled=true;
  try {
    await navigator.clipboard.writeText(text);
    if(request===session.request && rev===session.revision && session.canCopy()) $('copy-note').textContent='현재 결과를 복사했습니다.';
  } catch {
    if(request===session.request && rev===session.revision && session.canCopy()) {
      $('copy-note').textContent='자동 복사가 허용되지 않았습니다. 결과 텍스트 선택 후 ⌘C로 복사하세요.';
      $('output').focus();$('output').select();
    }
  } finally {if(request===session.request && rev===session.revision && session.canCopy())$('copy').disabled=false;}
});
render();publish({status:'EMPTY',message:'가공 표본을 불러오거나 새 수동 입력을 작성하세요.'});
