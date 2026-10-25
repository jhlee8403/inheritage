const $=id=>document.getElementById('pdf-'+id);
const LIMITS={bytes:8*1024*1024,pages:10,pixels:4000000,text:100000};
let revision=0,active=null,documentPdf=null,documentTask=null,pageNumber=0;
let pages=new Map(),currentRecord={state:'EMPTY',events:[]};
const cleanupJobs=new Set();
function status(state,message=''){currentRecord.state=state;$('status').textContent=`${state}${message?' · '+message:''}`;diagnostics();}
function diagnostics(){currentRecord.page=pageNumber;currentRecord.pages=documentPdf?.numPages??0;currentRecord.pendingCleanup=cleanupJobs.size;$('details').textContent=JSON.stringify(currentRecord,null,2);}
function log(op,stage,state,extra={}){op.record.events.push({stage,state,ms:Math.round(performance.now()-op.start),...extra});if(op.id===revision)diagnostics();}
function bound(promise,ms,label){let timer;return Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('TIMEOUT: '+label)),ms);})]).finally(()=>clearTimeout(timer));}
function track(promise){cleanupJobs.add(promise);void promise.finally(()=>{cleanupJobs.delete(promise);diagnostics();}).catch(()=>{});return promise;}
function controls(){const ready=!!documentPdf&&pageNumber>0;$('prev').disabled=!ready||pageNumber<=1;$('next').disabled=!ready||pageNumber>=documentPdf.numPages;$('ocr').disabled=!ready||!pages.has(pageNumber)||!!active;$('edited').disabled=!ready||!pages.has(pageNumber)||!!active&&active.kind!=='OCR';$('page').textContent=`${pageNumber} / ${documentPdf?.numPages??0}`;}
function clearView(){for(const id of ['direct','original','edited'])$(id).value='';const c=$('canvas');c.width=0;c.height=0;}
function viewCandidate(){const item=pages.get(pageNumber);$('direct').value=item?.direct??'';$('original').value=item?.ocr??'';$('edited').value=item?.edited??'';}
async function cleanup(op){
  if(op.disposal)return op.disposal;
  op.disposal=(async()=>{
    const errors=[];op.render?.cancel();
    try{await bound(Promise.resolve(op.worker?.terminate()),2000,'worker termination');}catch(e){errors.push(String(e));}
    op.raw?.terminate();if(op.url)URL.revokeObjectURL(op.url);
    if(op.loadingTask){try{await bound(op.loadingTask.destroy(),2000,'failed PDF destruction');}catch(e){errors.push(String(e));}}
    op.record.cleanup={state:errors.length?'FAIL':'PASS',errors};if(op.id===revision)diagnostics();
  })();return op.disposal;
}
function invalidate(){
  revision++;const old=active;active=null;
  if(old){old.abort.abort();track(cleanup(old));}
  controls();return revision;
}
function begin(kind){const id=invalidate();const op={id,kind,start:performance.now(),abort:new AbortController(),record:{kind,state:'RUNNING',events:[]}};active=op;currentRecord=op.record;status('RUNNING',kind);controls();return op;}
async function wait(op,promise,label,ms=15000){
  log(op,label,'START');let onAbort;
  try{
    if(op.id!==revision||op.abort.signal.aborted)throw Error('CANCELLED');
    const aborted=new Promise((_,reject)=>{onAbort=()=>reject(Error('CANCELLED'));op.abort.signal.addEventListener('abort',onAbort,{once:true});});
    const value=await bound(Promise.race([promise,aborted]),ms,label);
    if(op.id!==revision||op.abort.signal.aborted)throw Error('CANCELLED');
    log(op,label,'PASS');return value;
  }catch(error){log(op,label,String(error).includes('TIMEOUT')?'TIMEOUT':'FAIL',{error:String(error)});throw error;}
  finally{if(onAbort)op.abort.signal.removeEventListener('abort',onAbort);}
}
async function execute(op,fn){
  const overall=setTimeout(()=>{op.deadline=true;op.abort.abort();},45000);
  try{await fn();}
  catch(error){if(op.id===revision){if(op.kind!=='OCR'){clearView();pages.delete(pageNumber);}status(op.deadline||String(error).includes('TIMEOUT')?'TIMEOUT':'ERROR',String(error));op.record.error=String(error.stack??error);diagnostics();}}
  finally{clearTimeout(overall);await cleanup(op);if(op.id===revision){active=null;controls();diagnostics();}}
}
async function releaseDocument(task){if(task)await bound(task.destroy(),2000,'PDF destruction');}
async function renderPage(op){
  const number=pageNumber,doc=documentPdf;
  const page=await wait(op,doc.getPage(number),'PDF page');
  const viewport=page.getViewport({scale:2});
  if(!Number.isFinite(viewport.width*viewport.height)||Math.ceil(viewport.width)*Math.ceil(viewport.height)>LIMITS.pixels||viewport.width<1||viewport.height<1)throw Error('PIXEL_LIMIT');
  const canvas=$('canvas');canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);
  op.render=page.render({canvasContext:canvas.getContext('2d'),viewport});
  await wait(op,op.render.promise,'PDF render');op.render=null;
  const text=await wait(op,page.getTextContent(),'PDF direct text',10000);
  const direct=text.items.map(i=>i.str??'').join('\n');if(direct.length>LIMITS.text)throw Error('TEXT_LIMIT');
  if(!pages.has(number))pages.set(number,{direct,ocr:'',edited:direct});
  viewCandidate();page.cleanup();status('NEEDS_REVIEW',direct.trim()?'직접 추출 후보 · 법률 사실 미확정':'텍스트층 없음 · 사실 부존재가 아닙니다. 명시적으로 OCR을 실행하세요.');
}
$('file').addEventListener('change',()=>{
  const file=$('file').files[0],op=begin('PDF_OPEN'),oldTask=documentTask;
  documentTask=null;documentPdf=null;pages=new Map();pageNumber=0;clearView();controls();
  void execute(op,async()=>{
    await wait(op,releaseDocument(oldTask),'previous PDF release',3000);
    await wait(op,Promise.all([...cleanupJobs]),'previous operation cleanup',5000);
    if(!file){status('EMPTY');return;}
    if(file.size>LIMITS.bytes)throw Error('FILE_SIZE_LIMIT');if(file.size===0)throw Error('EMPTY_FILE');
    const data=new Uint8Array(await wait(op,file.arrayBuffer(),'File API read',10000));
    if(new TextDecoder().decode(data.subarray(0,5))!=='%PDF-')throw Error('INVALID_PDF_HEADER');
    op.loadingTask=pdfjs.getDocument({data,isEvalSupported:false,useWasm:false,useWorkerFetch:false,useSystemFonts:false,stopAtErrors:true});
    const doc=await wait(op,op.loadingTask.promise,'PDF open');
    if(doc.numPages>LIMITS.pages)throw Error('PAGE_LIMIT');
    documentPdf=doc;documentTask=op.loadingTask;op.loadingTask=null;pageNumber=1;controls();
    await renderPage(op);
  });
});
function move(delta){if(!documentPdf)return;const number=pageNumber+delta;if(number<1||number>documentPdf.numPages)return;const op=begin('PAGE');pageNumber=number;clearView();controls();void execute(op,()=>renderPage(op));}
$('prev').addEventListener('click',()=>move(-1));$('next').addEventListener('click',()=>move(1));
async function verifiedBytes(entry){
  if(typeof crypto?.subtle?.digest!=='function')throw Error('HASH_UNAVAILABLE');
  const bytes=Uint8Array.from(atob(entry.base64),c=>c.charCodeAt(0)),digest=await crypto.subtle.digest('SHA-256',bytes);
  const hex=Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');if(hex!==entry.sha256)throw Error('RESOURCE_HASH_MISMATCH');return bytes;
}
$('ocr').addEventListener('click',()=>{
  if(!documentPdf||active)return;const number=pageNumber,item=pages.get(number);if(!item)return;
  const op=begin('OCR');item.ocr='';item.edited='';viewCandidate();
  void execute(op,async()=>{
    const [wasm,model]=await wait(op,Promise.all([verifiedBytes(RESOURCES.wasm),verifiedBytes(RESOURCES.model)]),'resource SHA-256',5000);
    op.url=URL.createObjectURL(new Blob([WORKER_SOURCE],{type:'text/javascript'}));
    const NativeWorker=globalThis.Worker;let pending;
    globalThis.Worker=class extends NativeWorker{constructor(...args){super(...args);op.raw=this;this.addEventListener('error',e=>{log(op,'worker error','FAIL',{error:e.message});op.abort.abort();});this.postMessage({kind:'POC_RESOURCE_BYTES',wasm,model},[wasm.buffer,model.buffer]);}};
    try{pending=Tesseract.createWorker('kor',1,{workerPath:op.url,workerBlobURL:false,corePath:'memory-core:/preloaded.js',langPath:'memory-model:/kor',cacheMethod:'none',gzip:false,errorHandler:()=>{},logger:m=>{if(op.id===revision)log(op,m.status,'PROGRESS',{progress:m.progress});}});}finally{globalThis.Worker=NativeWorker;}
    pending.then(worker=>{if(op.id!==revision||op.abort.signal.aborted)return worker.terminate();}).catch(()=>{});
    op.worker=await wait(op,pending,'worker/core/WASM/kor initialize',20000);
    await wait(op,op.worker.setParameters({tessedit_pageseg_mode:'3',preserve_interword_spaces:'1',user_defined_dpi:'144'}),'OCR parameters',5000);
    const result=await wait(op,op.worker.recognize($('canvas'),{},{text:true}),'recognize',15000);
    const text=result.data.text;if(!text.trim())throw Error('EMPTY_OCR_CANDIDATE');if(text.length>LIMITS.text)throw Error('TEXT_LIMIT');
    item.ocr=text;item.edited=text;op.record.confidence=result.data.confidence;viewCandidate();status('NEEDS_REVIEW','OCR 후보 · 인명 누락 가능 · 원문 대조 필요');
  });
});
$('cancel').addEventListener('click',()=>{const old=active;invalidate();if(old)status('CANCELLED','이전 작업은 게시할 수 없습니다.');});
$('edited').addEventListener('input',()=>{const text=$('edited').value;invalidate();const item=pages.get(pageNumber);if(item)item.edited=text;status('NEEDS_REVIEW','사용자 수정 후보 · 법률 사실 미확정');});
$('close').addEventListener('click',()=>{invalidate();const task=documentTask;documentTask=null;documentPdf=null;pageNumber=0;pages.clear();$('file').value='';clearView();controls();status('EMPTY');const id=revision;track(releaseDocument(task).catch(error=>{if(id===revision)status('ERROR',String(error));}));});
addEventListener('pagehide',()=>{invalidate();void releaseDocument(documentTask).catch(()=>{});});
controls();diagnostics();
