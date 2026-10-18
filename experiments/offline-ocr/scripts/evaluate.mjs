// Repository end-to-end tests in a dedicated ephemeral Chromium. No user profile is used.
import { chromium } from 'playwright';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';
import os from 'node:os';
import { createServer } from './server.mjs';
import { measure } from './metrics.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const truth=JSON.parse(await readFile(path.join(root,'fixtures/truth.json'),'utf8'));
await mkdir(path.join(root,'results/screenshots'),{recursive:true});
const server=createServer();
await new Promise(resolve=>server.listen(4173,'127.0.0.1',resolve));
const origin='http://127.0.0.1:4173';
const browser=await chromium.launch({headless:true,chromiumSandbox:true});
const requests=[], consoleErrors=[];
const report={schemaVersion:1,startedAt:new Date().toISOString(),environment:{os:os.platform(),arch:os.arch(),release:os.release(),node:process.version,browser:browser.version(),headless:true,edge:'NOT_TESTED'},runs:[],checks:{},failures:[]};
const save=async()=>{
  const redact=value=>JSON.stringify(value,null,2).replaceAll(pathToFileURL(root).href,'file:///<experiment>/').replaceAll(root,'<experiment>/');
  await writeFile(path.join(root,'results/evaluation.json'),redact(report)+'\n');
  await writeFile(path.join(root,'results/network.json'),redact({requests,consoleErrors})+'\n');
};
async function context(label){
  const c=await browser.newContext({viewport:{width:1440,height:1100},serviceWorkers:'block'});
  // This is a test-scope request gate, not a change to the Mac's network policy.
  await c.route('**/*',async route=>{
    const url=route.request().url();
    if(url.startsWith(origin+'/')||url.startsWith('file:')||url.startsWith('data:')||url.startsWith('blob:'))await route.continue();
    else {requests.push({context:label,url,blockedExternal:true});await route.abort('blockedbyclient');}
  });
  c.on('request',request=>requests.push({context:label,url:request.url(),method:request.method(),resourceType:request.resourceType()}));
  c.on('page',p=>{p.on('console',m=>{if(m.type()==='error')consoleErrors.push({context:label,message:m.text()});});p.on('pageerror',e=>consoleErrors.push({context:label,message:e.message}));});
  return c;
}
async function ready(page){await page.waitForFunction(()=>window.spike && !window.spike.state().busy,{},{timeout:120000});}
async function load(page,filename='suite.pdf'){
  await page.goto(origin);await ready(page);
  await page.locator('#file').setInputFiles(path.join(root,'fixtures',filename));
  await page.waitForFunction(()=>window.spike?.state().loaded&&!window.spike.state().busy,{},{timeout:30000});
}
async function selectPage(page,n){await page.locator('#page').selectOption(String(n));await page.waitForFunction(n=>window.spike.state().current===n&&!window.spike.state().busy,n);}
async function clickAndWait(page,id){await page.locator(id).click();await ready(page);}
try {
  const cold=await context('cold-corpus');const page=await cold.newPage();
  const cdp=await cold.newCDPSession(page);await cdp.send('Network.enable');await cdp.send('Network.setCacheDisabled',{cacheDisabled:true});await cdp.send('Performance.enable');
  await load(page);
  report.checks.initialStorage=await page.evaluate(async()=>({localStorage:localStorage.length,sessionStorage:sessionStorage.length,indexedDB:(await indexedDB.databases()).map(x=>x.name),serviceWorkers:(await navigator.serviceWorker.getRegistrations()).length}));
  for(const expected of truth.pages){
    if(expected.page!==1)await selectPage(page,expected.page);
    await clickAndWait(page,'#process');
    const record=(await page.evaluate(()=>window.spike.snapshot())).pages.find(p=>p.page===expected.page);
    const text=await page.locator('#text').inputValue();
    assert.ok(record,await page.locator('#error').textContent());
    report.runs.push({page:expected.page,kind:expected.kind,record,text,metrics:measure(expected,text),mainThreadHeap:(await cdp.send('Performance.getMetrics')).metrics.find(x=>x.name==='JSHeapUsedSize')?.value??null});
    console.log(`page ${expected.page}: ${record.state}, ${record.attempts.at(-1)?.totalMs} ms, edits=${report.runs.at(-1).metrics.normalized.editDistance}`);
    await save();
  }
  assert.equal(report.runs[1].record.direct.length,0,'scan must not have hidden text');
  assert.equal(report.runs[3].record.direct.length,1,'hybrid title only');
  assert.ok(report.runs[3].record.attempts[0].ocr.length>0,'hybrid body must OCR despite title text');
  assert.ok(report.runs.every(r=>r.record.state==='NEEDS_REVIEW'),'all pages processed');
  report.checks.scanHasNoHiddenText=true;report.checks.hybridBodyOcr=true;
  await selectPage(page,7);
  for(let i=0;i<3;i++)await clickAndWait(page,'#rotate');
  await clickAndWait(page,'#process');
  const rotated=(await page.evaluate(()=>window.spike.snapshot())).pages.find(p=>p.page===7);
  report.correctedRotation={text:rotated.text,rotation:rotated.rotation,attempt:rotated.attempts.at(-1),metrics:measure(truth.pages[6],rotated.text)};
  // Verify PDF -> rotated viewport -> PDF corner mapping numerically for every source.
  report.checks.coordinateRoundTrip=await page.evaluate(()=>{
    let max=0;
    for(const p of window.spike.snapshot().pages){const [a,b,c,d,e,f]=p.viewportTransform;for(const r of p.candidates){const pts=r.pdfQuad.map(([x,y])=>[a*x+c*y+e,b*x+d*y+f]);const box=[Math.min(...pts.map(x=>x[0])),Math.min(...pts.map(x=>x[1])),Math.max(...pts.map(x=>x[0])),Math.max(...pts.map(x=>x[1]))];max=Math.max(max,...box.map((v,i)=>Math.abs(v-r.bbox[i])));}}
    return {maxPixelError:max};
  });
  assert.ok(report.checks.coordinateRoundTrip.maxPixelError<.01);
  await selectPage(page,2);
  await clickAndWait(page,'#process');
  const repeated=(await page.evaluate(()=>window.spike.snapshot())).pages.find(p=>p.page===2);
  report.repeat={attempt:repeated.attempts.at(-1),text:repeated.text,metrics:measure(truth.pages[1],repeated.text)};
  // Select the name line in actual rendered screen coordinates and re-OCR it.
  const box=await page.locator('#overlay').boundingBox();
  await page.mouse.move(box.x+35/595*box.width,box.y+135/842*box.height);
  await page.mouse.down();await page.mouse.move(box.x+400/595*box.width,box.y+185/842*box.height,{steps:8});await page.mouse.up();
  await clickAndWait(page,'#region');
  const region=(await page.evaluate(()=>window.spike.snapshot())).pages.find(p=>p.page===2);
  report.region={selection:(await page.evaluate(()=>window.spike.state())).selection,attempt:region.attempts.at(-1),text:region.text};
  assert.equal(region.attempts.at(-1).mode,'region');assert.equal(region.attempts.at(-1).ok,true);
  const corrected=truth.pages[1].expectedText;
  await page.locator('#text').fill(corrected);
  assert.equal(await page.locator('#text').inputValue(),corrected);
  report.checks.manualEdit={text:corrected,edits:(await page.evaluate(()=>window.spike.snapshot())).pages.find(p=>p.page===2).edits.length};
  await clickAndWait(page,'#select');
  report.checks.selection=await page.locator('#text').evaluate(el=>({start:el.selectionStart,end:el.selectionEnd,length:el.value.length}));
  assert.equal(report.checks.selection.end,corrected.length);
  await cold.grantPermissions(['clipboard-read','clipboard-write'],{origin});
  await page.locator('#copy').click();await page.waitForFunction(()=>document.getElementById('copy-status').textContent.includes('복사했습니다'));
  report.checks.clipboard={matched:await page.evaluate(async expected=>(await navigator.clipboard.readText())===`[후보 텍스트 · 사실 미확정]\n${expected}`,corrected),testPermission:'ephemeral context only'};
  assert.equal(report.checks.clipboard.matched,true);
  await page.screenshot({path:path.join(root,'results/screenshots/workbench.png'),fullPage:true});
  await selectPage(page,3);await selectPage(page,2);assert.equal(await page.locator('#text').inputValue(),corrected);
  report.checks.manualEditSurvivesNavigation=true;
  report.checks.finalStorage=await page.evaluate(async()=>({localStorage:localStorage.length,sessionStorage:sessionStorage.length,indexedDB:(await indexedDB.databases()).map(x=>x.name)}));
  await cold.close();

  // Real browser denial through a stricter response Permissions-Policy in a new context.
  const denied=await context('clipboard-denied');
  await denied.route(origin+'/',async route=>{const response=await route.fetch();await route.fulfill({response,headers:{...response.headers(),'Permissions-Policy':'clipboard-write=(), clipboard-read=()'}});});
  const dp=await denied.newPage();await load(dp,'text-only.pdf');await clickAndWait(dp,'#process');await dp.locator('#copy').click();
  await dp.waitForFunction(()=>document.getElementById('copy-status').textContent.includes('키보드'));
  report.checks.clipboardDeniedFallback=await dp.locator('#text').evaluate(el=>el.selectionEnd===el.value.length);
  await denied.close();

  const scanContext=await context('synthetic-scan-cold');const scanPage=await scanContext.newPage();
  await load(scanPage,'synthetic-scan.pdf');
  report.syntheticScan={pageCount:await scanPage.locator('#page option').count(),pages:[]};
  assert.equal(report.syntheticScan.pageCount,10);
  for(const expected of truth.pages){
    if(expected.page!==1)await selectPage(scanPage,expected.page);
    await clickAndWait(scanPage,'#process');
    const snapshot=await scanPage.evaluate(()=>window.spike.snapshot());
    const record=snapshot.pages.find(p=>p.page===expected.page);
    assert.ok(record,JSON.stringify(snapshot.executionErrors));
    const text=await scanPage.locator('#text').inputValue();
    report.syntheticScan.pages.push({page:expected.page,record,text,metrics:measure(expected,text)});
    console.log(`synthetic-scan page ${expected.page}: ${record.state}, direct=${record.direct.length}, OCR=${record.attempts.at(-1)?.ocr.length}`);
    assert.equal(record.direct.length,0);assert.equal(record.state,'NEEDS_REVIEW');assert.ok(record.attempts.at(-1).ocr.length>0);assert.ok(text.trim().length>0);
    await save();
  }
  await scanPage.screenshot({path:path.join(root,'results/screenshots/synthetic-scan.png'),fullPage:true});
  await scanContext.close();

  const fault=await context('missing-model-retry');
  const block=route=>route.fulfill({status:404,body:'Intentional missing local language asset for recovery test'});
  await fault.route('**/models/kor.traineddata',block);
  const fp=await fault.newPage();await load(fp,'scan-only.pdf');await clickAndWait(fp,'#process');
  const failed=(await fp.evaluate(()=>window.spike.snapshot())).pages[0];
  assert.equal(failed.state,'FAILED');
  await fault.unroute('**/models/kor.traineddata',block);
  await clickAndWait(fp,'#retry');
  const retried=(await fp.evaluate(()=>window.spike.snapshot())).pages[0];
  report.checks.retry={failure:failed.attempts[0],retried:retried.attempts.at(-1),state:retried.state};
  assert.equal(retried.state,'NEEDS_REVIEW');
  await fp.locator('#file').setInputFiles(path.join(root,'fixtures/invalid-pdf.bin'));await ready(fp);
  report.checks.invalidPdfError=await fp.locator('#error').textContent();
  assert.match(report.checks.invalidPdfError,/Invalid PDF|PDF.*invalid/i);
  await fp.locator('#file').setInputFiles(path.join(root,'fixtures/text-only.pdf'));
  await fp.waitForFunction(()=>window.spike.state().loaded&&!window.spike.state().busy);
  await clickAndWait(fp,'#process');
  report.checks.validFileAfterInvalid=(await fp.locator('#text').inputValue()).includes('가온새');
  await fault.close();

  const fileContext=await context('file-protocol');const filePage=await fileContext.newPage();
  await filePage.goto(pathToFileURL(path.join(root,'index.html')).href);
  await filePage.waitForTimeout(1500);
  report.fileProtocol={appInitialized:await filePage.evaluate(()=>!!window.spike),status:await filePage.locator('#status').textContent(),errors:consoleErrors.filter(e=>e.context==='file-protocol')};
  await filePage.screenshot({path:path.join(root,'results/screenshots/file-protocol.png'),fullPage:true});
  await fileContext.close();
  report.checks.externalRequests=requests.filter(r=>r.blockedExternal||/^https?:/.test(r.url)&&!r.url.startsWith(origin+'/'));
  report.checks.modelRequests=requests.filter(r=>r.url.includes('/models/')&&r.url.endsWith('.traineddata'));
  assert.equal(report.checks.externalRequests.length,0);
  report.completed=true;
}catch(error){report.failures.push({message:error.message,stack:error.stack?.replaceAll(root,'<experiment>/')});console.error(error);process.exitCode=1;}
finally{report.finishedAt=new Date().toISOString();await save();await browser.close();await new Promise(resolve=>server.close(resolve));}
