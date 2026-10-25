import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
const hash=text=>createHash('sha256').update(text).digest('base64');
const base=new URL('generated/lite-v1.html',import.meta.url);
const html=await readFile(base,'utf8'),scripts=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
function modified(source,resign){let text=html.replace('<script>'+scripts[5]+'</script>',()=>'<script>'+source+'</script>');if(resign)text=text.replace("'sha256-"+hash(scripts[5])+"'","'sha256-"+hash(source)+"'");return text;}
const variants={
  runtime:modified(scripts[5].replace("init.stage('pdf','TESSERACT_CODE');","init.stage('pdf','TESSERACT_CODE');throw new ReferenceError('synthetic Tesseract initialization fault');"),true),
  syntax:modified("(() => { const broken = ; })();",true),
  csp:modified(scripts[5]+'\n// intentional CSP mismatch',false),
  silent:modified('void 0;',true)
};
export async function run(page,check,report,browser){
  report.initializationProfiles=[];
  async function profile(name,inject,action){
    const context=await browser.newContext({offline:true,serviceWorkers:'block'}),p=await context.newPage();p.setDefaultTimeout(5000);
    const record={name,errors:[],consoleErrors:[],csp:[],externalRequests:[]};
    p.on('pageerror',e=>record.errors.push(String(e)));p.on('console',m=>{if(m.type()==='error')record.consoleErrors.push(m.text());});
    context.on('request',r=>{if(/^https?:/.test(r.url()))record.externalRequests.push(r.url());});
    await p.addInitScript(()=>{globalThis.__csp=[];addEventListener('securitypolicyviolation',e=>__csp.push(e.violatedDirective));});
    if(inject)await p.addInitScript(inject);
    let url=base;
    if(variants[name]){url=new URL(`generated/init-${name}.html`,import.meta.url);await writeFile(url,variants[name]);}
    try{
      await p.goto(url.href,{timeout:10000});await action(p,record);
      record.pdf=await p.locator('#pdf-init-status').textContent();record.c1=await p.locator('#c1-init-status').textContent();record.details=await p.locator('#pdf-init-details').textContent();record.csp=await p.evaluate(()=>__csp);
      assert.deepEqual(record.externalRequests,[]);report.initializationProfiles.push(record);
    }finally{await Promise.race([context.close(),new Promise((_,reject)=>setTimeout(()=>reject(Error('context cleanup TIMEOUT')),3000))]);}
  }
  const c1=async p=>{assert((await p.locator('#c1-init-status').textContent()).includes('READY'));await p.locator('[data-sample=spouse]').click();await p.locator('#calculate').click();await p.waitForFunction(()=>document.querySelector('#status').dataset.state==='REVIEW_READY');};
  await check('normal PDF/C1 READY before file choice and diagnostics nonempty',async()=>{
    assert((await page.locator('#pdf-init-status').textContent()).includes('READY'));assert((await page.locator('#c1-init-status').textContent()).includes('READY'));assert((await page.locator('#pdf-details').textContent()).length>0);
  });
  await check('missing TextDecoder reproduces pre-app failure and preserves C1',()=>profile('missing-decoder',()=>{delete globalThis.TextDecoder;},async p=>{
    assert((await p.locator('#pdf-init-status').textContent()).includes('FAILED'));assert((await p.locator('#pdf-init-status').textContent()).includes('PDF_WORKER_CODE'));assert((await p.locator('#pdf-details').textContent()).includes('TextDecoder'));assert(await p.locator('#pdf-file').isDisabled());await c1(p);
  }));
  await check('Tesseract initialization exception shows exact stage, C1 unaffected',()=>profile('runtime',null,async p=>{
    assert((await p.locator('#pdf-init-status').textContent()).includes('TESSERACT_CODE'));assert((await p.locator('#pdf-status').textContent()).startsWith('INIT_ERROR'));assert((await p.locator('#pdf-details').textContent()).includes('synthetic Tesseract'));await c1(p);
  }));
  await check('PDF-only parse error visible from independent bootstrap, C1 unaffected',()=>profile('syntax',null,async(p,r)=>{
    assert((await p.locator('#pdf-init-status').textContent()).includes('FAILED'));assert(r.errors.some(e=>e.includes('SyntaxError')));await c1(p);
  }));
  await check('PDF-only CSP hash mismatch fails visibly, no security relaxation',()=>profile('csp',null,async p=>{
    await p.waitForFunction(()=>document.querySelector('#pdf-details').textContent.includes('CSP_SCRIPT_BLOCKED'));await c1(p);
  }));
  await check('missing PDF completion becomes TIMEOUT instead of quiet EMPTY',()=>profile('silent',null,async p=>{
    await p.waitForFunction(()=>document.querySelector('#pdf-init-status').textContent.includes('TIMEOUT'),null,{timeout:12000});assert((await p.locator('#pdf-status').textContent()).startsWith('INIT_ERROR'));await c1(p);
  }),15000);
  await check('worker/WASM absence does not prevent initial PDF diagnostic or direct PDF',()=>profile('worker-blocked',()=>{
    globalThis.Worker=class {constructor(){throw Error('synthetic worker policy block');}};delete globalThis.WebAssembly;
  },async p=>{
    assert((await p.locator('#pdf-init-status').textContent()).includes('READY'));
    await p.locator('#pdf-file').setInputFiles(fileURLToPath(new URL('../offline-ocr/fixtures/text-only.pdf',import.meta.url)));
    await p.waitForFunction(()=>document.querySelector('#pdf-status').textContent.startsWith('NEEDS_REVIEW'));assert((await p.locator('#pdf-direct').inputValue()).includes('가온새'));
    await p.waitForFunction(()=>!document.querySelector('#pdf-ocr').disabled);await p.locator('#pdf-ocr').click();await p.waitForFunction(()=>document.querySelector('#pdf-status').textContent.startsWith('ERROR'));assert((await p.locator('#pdf-details').textContent()).includes('synthetic worker policy block'));await c1(p);
  }));
  await check('missing lazy modern APIs recorded without falsely blaming initial bootstrap',()=>profile('lazy-apis',()=>{
    delete Promise.withResolvers;delete Promise.try;delete Map.prototype.getOrInsertComputed;delete URL.parse;
  },async p=>{
    assert((await p.locator('#pdf-init-status').textContent()).includes('READY'));assert((await p.locator('#pdf-init-details').textContent()).includes('"promiseWithResolvers": false'));
    await p.locator('#pdf-file').setInputFiles(fileURLToPath(new URL('../offline-ocr/fixtures/text-only.pdf',import.meta.url)));await p.waitForFunction(()=>document.querySelector('#pdf-status').textContent.startsWith('ERROR'));assert((await p.locator('#pdf-details').textContent()).includes('withResolvers'));await c1(p);
  }));
}
