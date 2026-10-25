const $=id=>document.getElementById(id);
let epoch=0, active=null;
const decode=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
async function verify(entry){
  if(typeof crypto?.subtle?.digest!=='function')throw new Error('HASH_UNAVAILABLE');
  const bytes=decode(entry.base64),sum=await crypto.subtle.digest('SHA-256',bytes);
  const hash=Array.from(new Uint8Array(sum),b=>b.toString(16).padStart(2,'0')).join('');
  if(hash!==entry.sha256)throw new Error('RESOURCE_HASH_MISMATCH');
  return bytes;
}
function show(run){if(run.id!==epoch)return;$('details').textContent=JSON.stringify(run.record,null,2);}
function bounded(promise,ms,label){
  let timer;return Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('TIMEOUT: '+label)),ms);})]).finally(()=>clearTimeout(timer));
}
async function dispose(run){
  if(run.disposal)return run.disposal;
  run.disposal=(async()=>{
    const errors=[];
    try{await bounded(Promise.resolve(run.worker?.terminate()),2000,'worker termination');}catch(error){errors.push(String(error));}
    run.raw?.terminate();
    if(run.url)URL.revokeObjectURL(run.url);
    try{await bounded(Promise.resolve(run.pdfTask?.destroy()),2000,'PDF destruction');}catch(error){errors.push(String(error));}
    run.record.cleanup={state:errors.length?'FAIL':'PASS',errors};show(run);
  })();return run.disposal;
}
function cancel(){
  if(!active)return;const run=active;epoch++;active=null;run.abort.abort();
  $('text').value='';$('status').textContent='CANCELLED';$('run').disabled=false;
  run.record.state='CANCELLED';$('details').textContent=JSON.stringify(run.record,null,2);
  void dispose(run).catch(()=>{});
}
$('cancel').addEventListener('click',cancel);
$('run').addEventListener('click',async()=>{
  if(active)cancel();
  const start=performance.now(),run={id:++epoch,abort:new AbortController(),record:{state:'RUNNING',
    stages:{integrity:'NOT_RUN',pdfRender:'NOT_RUN',worker:'NOT_RUN',wasm:'NOT_RUN',model:'NOT_RUN',ocr:'NOT_RUN'},
    language:'kor',candidateStatus:'NEEDS_REVIEW',timingsMs:{},events:[]}};
  active=run;$('text').value='';$('status').textContent='RUNNING';$('run').disabled=true;show(run);
  const guard=(promise,label='initialization',ms=15000)=>{
    run.record.waitingAt=label;run.record.events.push({status:label,phase:'START',ms:Math.round(performance.now()-start)});show(run);
    if(run.abort.signal.aborted)return Promise.reject(new Error('CANCELLED'));
    let rejectAbort;const cancelled=new Promise((_,reject)=>{rejectAbort=()=>reject(new Error('CANCELLED'));run.abort.signal.addEventListener('abort',rejectAbort,{once:true});});
    return bounded(Promise.race([promise,cancelled]),ms,label).then(value=>{run.record.events.push({status:label,phase:'PASS',ms:Math.round(performance.now()-start)});return value;}).finally(()=>run.abort.signal.removeEventListener('abort',rejectAbort));
  };
  const timer=setTimeout(()=>{run.deadline=true;run.abort.abort();},45000);
  try{
    const [wasm,model,pdf]=await guard(Promise.all([verify(RESOURCES.wasm),verify(RESOURCES.model),verify(RESOURCES.pdf)]),'resource SHA-256',5000);
    run.record.stages.integrity='PASS';show(run);
    run.pdfTask=pdfjs.getDocument({data:pdf,isEvalSupported:false,useWasm:false,useWorkerFetch:false,useSystemFonts:false});
    const documentPdf=await guard(run.pdfTask.promise,'PDF open'),page=await guard(documentPdf.getPage(1),'PDF page');
    const viewport=page.getViewport({scale:2}),canvas=$('page');canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);
    if(canvas.width*canvas.height>4000000)throw new Error('PIXEL_LIMIT');
    await guard(page.render({canvasContext:canvas.getContext('2d'),viewport}).promise,'PDF render');
    const content=await guard(page.getTextContent(),'PDF direct text');
    run.record.directText=content.items.map(i=>i.str??'').join('').trim();
    if(run.record.directText)throw new Error('FIXTURE_IS_NOT_SCAN_ONLY');
    run.record.stages.pdfRender='PASS';run.record.timingsMs.render=Math.round(performance.now()-start);show(run);
    run.url=URL.createObjectURL(new Blob([WORKER_SOURCE],{type:'text/javascript'}));
    const NativeWorker=globalThis.Worker;
    // Capture only the genuine worker handle for cancellation; never replace its results.
    globalThis.Worker=class extends NativeWorker{constructor(...args){super(...args);run.raw=this;this.addEventListener('error',event=>{(run.record.workerErrors??=[]).push(event.message);show(run);});this.postMessage({kind:'POC_RESOURCE_BYTES',wasm,model},[wasm.buffer,model.buffer]);}};
    let pending;
    const workerStart=performance.now();
    try{
      pending=Tesseract.createWorker('kor',1,{workerPath:run.url,workerBlobURL:false,
        corePath:'memory-core:/preloaded.js',langPath:'memory-model:/kor',cacheMethod:'none',gzip:false,
        errorHandler:()=>{},logger:message=>{
          if(run.id!==epoch)return;
          run.record.events.push({status:message.status,progress:message.progress,ms:Math.round(performance.now()-start)});
          if(message.status==='BLOB_WORKER_BOOTED')run.record.stages.worker='PASS';
          if(message.status==='WASM_RUNTIME_READY')run.record.stages.wasm='PASS';
          show(run);
        }});
    }finally{globalThis.Worker=NativeWorker;}
    pending.then(worker=>{if(run.id!==epoch)return worker.terminate();}).catch(()=>{});
    run.worker=await guard(pending,'worker/core/WASM/kor initialize',20000);
    run.record.stages.model='PASS';run.record.timingsMs.initialization=Math.round(performance.now()-workerStart);show(run);
    await guard(run.worker.setParameters({tessedit_pageseg_mode:'3',preserve_interword_spaces:'1',user_defined_dpi:'144'}),'OCR parameters',5000);
    const ocrStart=performance.now(),result=await guard(run.worker.recognize(canvas,{}, {text:true}),'recognize',15000);
    const text=result.data.text;
    if(!text.trim()||!/[가-힣]/.test(text))throw new Error('NO_KOREAN_OCR_CANDIDATE');
    if(run.id!==epoch)return;
    run.record.stages.ocr='PASS';run.record.state='NEEDS_REVIEW';run.record.text=text;
    run.record.confidence=result.data.confidence;run.record.timingsMs.ocr=Math.round(performance.now()-ocrStart);run.record.timingsMs.total=Math.round(performance.now()-start);
    $('text').value=text;$('status').textContent='NEEDS_REVIEW';show(run);
  }catch(error){
    if(run.id===epoch){run.record.state=run.deadline||String(error).includes('TIMEOUT')?'TIMEOUT':'FAIL';run.record.error=run.deadline?'TIMEOUT: overall 45000ms':error.stack??String(error);$('status').textContent='ERROR';$('text').value='';show(run);}
  }finally{
    clearTimeout(timer);await dispose(run).catch(()=>{});
    if(run.id===epoch){active=null;$('run').disabled=false;}
  }
});
