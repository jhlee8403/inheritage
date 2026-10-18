import { PdfOcrSession } from './engine.mjs';
const $ = id => document.getElementById(id);
const canvas = $('page-canvas'), overlay = $('overlay');
let busy = false, current = 1, loaded = false, selection = null, drag = null;
let lastFailedAction = null;
const executionErrors = [];
const rotations = new Map();
const session = new PdfOcrSession((status, progress) => { $('status').textContent = `${status} ${Number.isFinite(progress) ? Math.round(progress*100)+'%' : ''}`; });
function controls() {
  for (const id of ['page', 'rotate', 'process', 'full']) $(id).disabled = busy || !loaded;
  $('file').disabled = busy;
  $('region').disabled = busy || !loaded || !selection;
  $('retry').disabled = busy || !lastFailedAction;
  for (const id of ['text', 'copy', 'select']) $(id).disabled = busy || !loaded;
}
function display() {
  const r = session.pages.get(current);
  $('text').value = r?.text || '';
  $('method').textContent = r ? `${r.state} · 직접 추출 ${r.direct.length}항목 · 이미지 ${r.images.length}영역` : '원문 대조 필요';
  $('details').textContent = JSON.stringify(session.snapshot(), null, 2);
  const ctx = overlay.getContext('2d'); ctx.clearRect(0, 0, overlay.width, overlay.height);
  for (const c of r?.candidates || []) { ctx.strokeStyle = c.source === 'OCR' ? '#b78527' : '#318b69'; ctx.lineWidth=2; ctx.strokeRect(c.bbox[0],c.bbox[1],c.bbox[2]-c.bbox[0],c.bbox[3]-c.bbox[1]); }
  if (selection) { ctx.fillStyle='#2b806633'; ctx.strokeStyle='#175b49'; ctx.lineWidth=3; ctx.fillRect(selection[0],selection[1],selection[2]-selection[0],selection[3]-selection[1]);ctx.strokeRect(selection[0],selection[1],selection[2]-selection[0],selection[3]-selection[1]); }
  $('selection').textContent = selection ? `페이지 ${current} · 렌더 좌표(px): ${selection.map(Math.round).join(', ')}` : '선택 영역 없음';
  controls();
}
async function run(action) {
  if (busy) return;
  busy=true; $('error').hidden=true; controls();
  try { await action(); lastFailedAction=null; $('status').textContent = '처리 완료 · 원문 대조와 수동 수정이 필요합니다.'; }
  catch (error) { lastFailedAction=action; executionErrors.push({page:current,message:String(error.message||error),stack:error.stack||null}); console.error(error); $('error').textContent=String(error.message || error); $('error').hidden=false; $('status').textContent='처리 실패 · 오류를 확인하고 재시도하세요.'; }
  finally { busy=false; display(); }
}
async function render() {
  selection=null;
  await session.render(current, canvas, rotations.get(current) || 0);
  overlay.width=canvas.width; overlay.height=canvas.height;
}
$('file').addEventListener('change', () => run(async () => {
  const file=$('file').files[0]; if (!file) return;
  loaded=false; rotations.clear(); $('page').replaceChildren();
  if (file.size > 50*1024*1024) throw new Error('B1 실험 파일 한도는 50 MB입니다.');
  const count=await session.open(new Uint8Array(await file.arrayBuffer()));
  if (count > 100) throw new Error('B1 실험 파일은 100쪽 이하만 허용합니다.');
  for(let p=1;p<=count;p++){ const o=document.createElement('option');o.value=p;o.textContent=`${p} / ${count}`;$('page').append(o); }
  current=1; await render(); loaded=true;
}));
$('page').addEventListener('change', () => run(async () => { current=Number($('page').value); await render(); }));
$('rotate').addEventListener('click', () => run(async () => { rotations.set(current,((rotations.get(current)||0)+90)%360); await render(); }));
$('process').addEventListener('click', () => run(() => session.process(current,canvas,'auto')));
$('full').addEventListener('click', () => run(() => session.process(current,canvas,'full')));
$('region').addEventListener('click', () => run(() => session.process(current,canvas,'region',selection)));
$('retry').addEventListener('click', () => { if(lastFailedAction)run(lastFailedAction); });
$('text').addEventListener('input', () => { session.edit(current,$('text').value); $('details').textContent=JSON.stringify(session.snapshot(),null,2); });
$('select').addEventListener('click', () => { $('text').focus(); $('text').select(); $('copy-status').textContent='선택한 텍스트를 키보드로 복사할 수 있습니다.'; });
$('copy').addEventListener('click', async () => {
  try { await navigator.clipboard.writeText(`[후보 텍스트 · 사실 미확정]\n${$('text').value}`); $('copy-status').textContent='후보 표시를 포함해 복사했습니다.'; }
  catch { $('text').focus(); $('text').select(); $('copy-status').textContent='자동 복사가 허용되지 않았습니다. 선택된 텍스트를 키보드로 복사하세요.'; }
});
function point(e) { const box=overlay.getBoundingClientRect(); return [Math.max(0,Math.min(canvas.width,(e.clientX-box.left)*canvas.width/box.width)),Math.max(0,Math.min(canvas.height,(e.clientY-box.top)*canvas.height/box.height))]; }
overlay.addEventListener('pointerdown', e => { if(busy||!loaded)return;drag=point(e);overlay.setPointerCapture(e.pointerId); });
overlay.addEventListener('pointermove', e => { if(!drag)return; const p=point(e);selection=[Math.min(drag[0],p[0]),Math.min(drag[1],p[1]),Math.max(drag[0],p[0]),Math.max(drag[1],p[1])];display(); });
overlay.addEventListener('pointerup', () => { drag=null;if(selection&&(selection[2]-selection[0]<5||selection[3]-selection[1]<5))selection=null;display(); });
overlay.addEventListener('pointercancel', () => { drag=null;selection=null;display(); });
// Read-only snapshot for the local evaluation harness; it does not contain fixture truth.
window.spike = { snapshot: () => ({...session.snapshot(),executionErrors}), state: () => ({busy,current,loaded,selection}) };
$('status').textContent='가공 PDF를 선택하세요. 데이터는 이 탭의 메모리에서만 처리됩니다.';
controls();
