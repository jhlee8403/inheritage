import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { existsSync } from 'node:fs';
import { chromium } from '../offline-ocr/node_modules/playwright/index.mjs';
import { ocrRoot } from './assets.mjs';
const edge='/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge';
const generated=new URL('generated/',import.meta.url),results=new URL('results/',import.meta.url);
await mkdir(generated,{recursive:true});await mkdir(results,{recursive:true});
await writeFile(new URL('probe.html',generated),'<!doctype html><meta charset="utf-8"><title>Local resource probe</title><link rel="icon" href="data:,">');
const local=path=>new URL(path,ocrRoot).href;
const truth=JSON.parse(await readFile(new URL('fixtures/truth.json',ocrRoot),'utf8')).pages[0].expectedText;
const report={schemaVersion:1,mode:'file://; isolated contexts; emulated offline; no security overrides',windowsOCR:'NOT_RUN',browsers:[]};
for(const target of [{name:'Chromium'},...(existsSync(edge)?[{name:'Mac Microsoft Edge',executablePath:edge}]:[])]){
  let browser;const record={name:target.name,observations:[],assertions:[],unexpectedErrors:[],externalRequests:[]};
  try{
    browser=await chromium.launch({headless:true,chromiumSandbox:true,timeout:30000,...(target.executablePath?{executablePath:target.executablePath}:{})});
    record.version=browser.version();
    const context=await browser.newContext({offline:true,serviceWorkers:'block'});
    await context.addInitScript(()=>{globalThis.__resourceUnhandled=[];addEventListener('unhandledrejection',e=>__resourceUnhandled.push(String(e.reason)));});
    context.on('request',r=>{if(/^https?:/.test(r.url()))record.externalRequests.push(r.url());});
    await context.route('**/*',async r=>{if(/^https?:/.test(r.request().url()))await r.abort();else await r.continue();});
    const original=await context.newPage(),originalErrors=[];
    original.on('console',m=>{if(m.type()==='error')originalErrors.push(m.text());});
    await original.goto(local('index.html'));await original.waitForTimeout(100);
    const originalStatus=await original.locator('#status').textContent();
    record.observations.push({component:'ORIGINAL_OCR_FILE_APP',status:originalStatus.includes('초기화 중')?'FAIL':'PASS',display:originalStatus,errors:originalErrors,unhandledRejections:await original.evaluate(()=>__resourceUnhandled)});
    await original.close();
    const page=await context.newPage(),expectedResourceErrors=[];
    page.on('console',m=>{if(m.type()==='error')expectedResourceErrors.push(m.text());});
    page.on('pageerror',e=>record.unexpectedErrors.push(e.stack));
    await page.goto(new URL('probe.html',generated).href);
    const observe=async(component,action)=>{
      try{const detail=await action();record.observations.push({component,status:'PASS',...detail});}
      catch(error){record.observations.push({component,status:'FAIL',error:String(error),stack:error.stack});}
    };
    await observe('PDFJS_ES_MODULE_FILE_IMPORT',()=>page.evaluate(async url=>{const m=await import(url);return {version:m.version};},local('public/vendor/pdfjs/pdf.mjs')));
    await observe('PDFJS_NATIVE_MODULE_WORKER',()=>page.evaluate(url=>new Promise((resolve,reject)=>{
      let worker;try{worker=new Worker(url,{type:'module'});}catch(e){reject(e);return;}
      const timeout=setTimeout(()=>{worker.terminate();reject(new Error('worker bootstrap timed out'));},5000);
      worker.onerror=e=>{e.preventDefault();clearTimeout(timeout);worker.terminate();reject(new Error(e.message));};
      worker.onmessage=e=>{clearTimeout(timeout);worker.terminate();resolve({message:e.data});};
    }),local('public/vendor/pdfjs/pdf.worker.mjs')));
    await observe('TESSERACT_CLASSIC_SCRIPT',async()=>{await page.addScriptTag({url:local('public/vendor/tesseract/tesseract.min.js')});return {createWorker:await page.evaluate(()=>typeof Tesseract.createWorker)};});
    await observe('TESSERACT_WORKER_PIPELINE',()=>page.evaluate(async base=>{
      let timer;
      const pending=Tesseract.createWorker('kor+eng+chi_tra',1,{workerPath:base+'public/vendor/tesseract/worker.min.js',
        corePath:base+'public/vendor/tesseract-core/',langPath:base+'public/models/',gzip:false,cacheMethod:'none',workerBlobURL:false,errorHandler:()=>{}});
      try{const worker=await Promise.race([pending,new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('local worker init timeout')),8000);})]);await worker.terminate();return {initialized:true};}
      finally{clearTimeout(timer);pending.then(w=>w.terminate()).catch(()=>{});}
    },ocrRoot.href));
    for(const [component,path] of [
      ['TESSERACT_WASM_FILE_FETCH','public/vendor/tesseract-core/tesseract-core-simd-lstm.wasm'],
      ['MODEL_KOR_FILE_FETCH','public/models/kor.traineddata'],['MODEL_ENG_FILE_FETCH','public/models/eng.traineddata'],
      ['MODEL_CHI_TRA_FILE_FETCH','public/models/chi_tra.traineddata'],
    ])await observe(component,()=>page.evaluate(async url=>{const r=await fetch(url,{cache:'no-store',signal:AbortSignal.timeout(5000)});if(!r.ok)throw new Error(`status ${r.status}`);return {bytes:(await r.arrayBuffer()).byteLength};},local(path)));
    record.resourceConsoleErrors=expectedResourceErrors;
    record.resourceUnhandledRejections=await page.evaluate(()=>__resourceUnhandled);
    record.observations.push({component:'SCANNED_PDF_OCR_RECOGNITION',status:'NOT_RUN',reason:'No recognize() call; worker/model file prerequisites did not initialize. No accuracy evaluation.'});
    record.observations.push({component:'WASM_EXECUTION_AND_LANGUAGE_INITIALIZATION',status:'NOT_RUN',reason:'Resource fetch tests are not WebAssembly execution or model initialization.'});
    await page.close();
    const direct=await context.newPage(),diagnostics={consoleErrors:[],pageErrors:[],unhandledRejections:[],requests:[],cspViolations:[]};
    direct.on('console',m=>{if(m.type()==='error')diagnostics.consoleErrors.push(m.text());});
    direct.on('pageerror',e=>diagnostics.pageErrors.push(e.stack));direct.on('request',r=>diagnostics.requests.push(r.url()));
    await direct.addInitScript(()=>{
      globalThis.__unhandled=[];globalThis.__csp=[];
      addEventListener('unhandledrejection',e=>__unhandled.push(String(e.reason)));
      addEventListener('securitypolicyviolation',e=>__csp.push({directive:e.violatedDirective,blocked:e.blockedURI}));
    });
    await direct.goto(new URL('direct-text.html',generated).href);
    await direct.locator('#run').click();await direct.waitForFunction(()=>['PASS','FAIL'].includes(document.querySelector('#status').textContent),null,{timeout:20000});
    const status=await direct.locator('#status').textContent(),details=await direct.locator('#details').textContent();
    const text=await direct.locator('#text').inputValue();
    const normalize=t=>t.normalize('NFC').replace(/\s/g,'');
    record.observations.push({component:'PDF_DIRECT_TEXT_MAIN_THREAD',status,text,details});
    const check=(name,fn)=>{try{fn();record.assertions.push({name,pass:true});}catch(e){record.assertions.push({name,pass:false,error:e.stack});}};
    check('fixed existing synthetic text is extracted without changing expected truth',()=>{assert.equal(status,'PASS');assert.equal(normalize(text),normalize(truth));});
    const pixels=await direct.locator('canvas').evaluate(canvas=>{
      const data=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;let dark=0;
      for(let i=0;i<data.length;i+=4)if(data[i]+data[i+1]+data[i+2]<500)dark++;
      return {width:canvas.width,height:canvas.height,dark};
    });
    record.observations.push({component:'PDF_FIRST_PAGE_RENDER_MAIN_THREAD',status:status==='PASS'&&pixels.dark>100?'PASS':'FAIL',pixels});
    check('first page rendered nonblank pixels',()=>assert(pixels.width>0&&pixels.dark>100));
    check('one-page original fixture independently checked by pypdf; candidate remains NEEDS_REVIEW',()=>{
      const d=JSON.parse(details);assert.equal(d.numPages,1);assert.deepEqual(d.renderedPages,[1]);assert.equal(d.status,'NEEDS_REVIEW');assert.equal(d.ocr,'NOT_RUN');
    });
    await direct.screenshot({path:`/private/tmp/inheritage-pdf-file-${target.executablePath?'edge':'chromium'}.png`,fullPage:true});
    diagnostics.unhandledRejections=await direct.evaluate(()=>__unhandled);diagnostics.cspViolations=await direct.evaluate(()=>__csp);
    record.directDiagnostics=diagnostics;
    check('direct trial has no console/page/promise/CSP errors or extra resources',()=>{
      for(const key of ['consoleErrors','pageErrors','unhandledRejections','cspViolations'])assert.deepEqual(diagnostics[key],[]);
      assert.deepEqual(diagnostics.requests,[new URL('direct-text.html',generated).href]);assert.deepEqual(record.externalRequests,[]);
      assert.deepEqual(record.unexpectedErrors,[]);assert.deepEqual(record.resourceUnhandledRejections,[]);
    });
    report.browsers.push(record);
  }catch(error){record.fatal=error.stack;report.browsers.push(record);}
  finally{if(browser)await browser.close();}
}
let serialized=JSON.stringify(report,null,2).replaceAll(ocrRoot.href,'<ocr>/').replaceAll(generated.href,'<generated>/').replaceAll(fileURLToPath(ocrRoot),'<ocr>/').replaceAll(fileURLToPath(generated),'<generated>/').replaceAll(new URL('../../',import.meta.url).href,'<repo>/').replaceAll(fileURLToPath(new URL('../../',import.meta.url)),'<repo>/');
await writeFile(new URL('file-results.json',results),serialized+'\n');
console.log(serialized);
if(report.browsers.some(b=>b.fatal||b.assertions.some(c=>!c.pass)||b.externalRequests.length))process.exitCode=1;
