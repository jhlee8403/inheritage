import {chromium} from '../offline-ocr/node_modules/playwright/index.mjs';
import {readFileSync,writeFileSync,appendFileSync,mkdirSync,existsSync} from 'node:fs';
import assert from 'node:assert/strict';
import {measure} from '../offline-ocr/scripts/metrics.mjs';
const target=process.argv[2]??'chromium';
if(!['chromium','edge'].includes(target))throw new Error('Use chromium or edge');
const edge='/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge';
const root=new URL('../../',import.meta.url);
const clean=value=>String(value).replaceAll(root.href,'<repo>/').replaceAll(decodeURI(root.pathname),'<repo>/');
const out=new URL(`results/${target}.json`,import.meta.url),log=new URL(`results/${target}.jsonl`,import.meta.url);
mkdirSync(new URL('results/',import.meta.url),{recursive:true});
const report={target,started:new Date().toISOString(),windows:'NOT_RUN',offline:'fresh context, empty cache, browser offline emulation; physical disconnection NOT_RUN',checks:[],stages:[],diagnostics:{consoleErrors:[],pageErrors:[],externalRequests:[],unhandledRejections:[],cspViolations:[]}};
const save=()=>writeFileSync(out,clean(JSON.stringify(report,null,2))+'\n');
const emit=(stage,state,extra={})=>{const row={time:new Date().toISOString(),stage,state,...extra};report.stages.push(row);appendFileSync(log,clean(JSON.stringify(row))+'\n');save();console.log(JSON.stringify(row));};
let server,browser,ownedPid;
const stopOwned=()=>{if(ownedPid){try{process.kill(ownedPid,'SIGKILL');report.killedOwnBrowserPid=ownedPid;}catch(error){if(error.code!=='ESRCH')report.killError=String(error);}}};
// Absolute process deadline also bounds Playwright teardown. Only the browser PID
// returned by this run's BrowserServer is eligible for the emergency signal.
const deadline=setTimeout(()=>{report.fatal='TIMEOUT: absolute test deadline 100000ms';emit('absolute deadline','TIMEOUT');stopOwned();save();process.exit(1);},100000);
async function step(name,action,ms=10000){
  emit(name,'START');let timer;
  try{const value=await Promise.race([Promise.resolve().then(action),new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error(`TIMEOUT: ${name} ${ms}ms`)),ms);})]);emit(name,'PASS');return value;}
  catch(error){emit(name,/timeout/i.test(String(error))?'TIMEOUT':'FAIL',{error:String(error)});throw error;}
  finally{clearTimeout(timer);}
}
function check(name,fn){try{fn();report.checks.push({name,state:'PASS'});}catch(error){report.checks.push({name,state:'FAIL',error:String(error)});}save();}
try{
  if(target==='edge'&&!existsSync(edge))throw new Error('EDGE_NOT_INSTALLED');
  server=await step('browser launch',()=>chromium.launchServer({headless:true,chromiumSandbox:true,timeout:20000,...(target==='edge'?{executablePath:edge}:{})}),25000);
  ownedPid=server.process().pid;report.browserPid=ownedPid;
  browser=await step('browser connect',()=>chromium.connect(server.wsEndpoint(),{timeout:10000}));report.version=browser.version();
  const context=await step('fresh offline context',()=>browser.newContext({offline:true,serviceWorkers:'block'}));
  report.requests=[];context.on('request',r=>{report.requests.push(r.url());if(/^https?:/.test(r.url()))report.diagnostics.externalRequests.push(r.url());});
  await step('request guard',()=>context.route('**/*',r=>/^https?:/.test(r.request().url())?r.abort():r.continue()));
  const page=await step('page creation',()=>context.newPage());page.setDefaultTimeout(10000);
  page.on('console',m=>{if(m.type()==='error')report.diagnostics.consoleErrors.push(m.text());});
  page.on('pageerror',e=>report.diagnostics.pageErrors.push(String(e)));
  await step('diagnostic hooks',()=>page.addInitScript(()=>{
    globalThis.__unhandled=[];globalThis.__csp=[];
    addEventListener('unhandledrejection',e=>__unhandled.push(String(e.reason)));
    addEventListener('securitypolicyviolation',e=>__csp.push({directive:e.violatedDirective,blocked:e.blockedURI}));
  }));
  await step('file HTML load',()=>page.goto(new URL('generated/kor-ocr.html',import.meta.url).href,{waitUntil:'load',timeout:15000}),17000);
  let last='';
  const poll=setInterval(()=>{page.locator('#details').textContent({timeout:1000}).then(text=>{
    if(text&&text!==last){last=text;try{report.progress=JSON.parse(text);save();}catch{}}
  }).catch(()=>{});},200);
  try{
    await step('OCR start',()=>page.locator('#run').click());
    await step('worker/WASM/model/recognize result',()=>page.waitForFunction(()=>['NEEDS_REVIEW','ERROR'].includes(document.querySelector('#status').textContent),null,{timeout:47000}),49000);
    report.initial=await step('read OCR result',()=>page.evaluate(()=>({status:document.querySelector('#status').textContent,details:JSON.parse(document.querySelector('#details').textContent)})));
    check('real Korean candidate from scan',()=>{assert.equal(report.initial.status,'NEEDS_REVIEW');assert(/[가-힣]/.test(report.initial.details.text));assert.equal(report.initial.details.directText,'');});
    check('worker/WASM/model stages',()=>{for(const key of ['integrity','pdfRender','worker','wasm','model','ocr'])assert.equal(report.initial.details.stages[key],'PASS',key);assert.deepEqual(report.initial.details.workerErrors??[],[]);});
    if(report.initial.status!=='NEEDS_REVIEW')throw new Error('OCR did not generate a candidate');
    const truth=JSON.parse(readFileSync(new URL('../offline-ocr/fixtures/truth.json',import.meta.url),'utf8')).pages[1];report.accuracy=measure(truth,report.initial.details.text);
    await step('worker cancellation observer',()=>page.evaluate(()=>{
      const observer=new MutationObserver(()=>{
        if(document.querySelector('#details').textContent.includes('"worker": "PASS"')&&document.querySelector('#status').textContent==='RUNNING'){observer.disconnect();document.querySelector('#cancel').click();}
      });observer.observe(document.querySelector('#details'),{childList:true});
    }));
    await step('cancel run start',()=>page.locator('#run').click());
    await step('cancel acknowledgement',()=>page.waitForFunction(()=>document.querySelector('#status').textContent==='CANCELLED'));
    await step('late cancellation observation',()=>page.waitForTimeout(500),1000);
    const cancelled=await step('read cancelled result',()=>page.evaluate(()=>({status:document.querySelector('#status').textContent,text:document.querySelector('#text').value})));
    check('cancel prevents late publication',()=>assert.deepEqual(cancelled,{status:'CANCELLED',text:''}));
    await step('inject synthetic hash rejection',()=>page.evaluate(()=>{crypto.subtle.digest=()=>Promise.reject(new Error('synthetic hash failure'));}));
    await step('hash failure start',()=>page.locator('#run').click());
    await step('hash failure result',()=>page.waitForFunction(()=>document.querySelector('#status').textContent==='ERROR'));
    const rejected=await step('read hash rejection',()=>page.evaluate(()=>({text:document.querySelector('#text').value,details:JSON.parse(document.querySelector('#details').textContent)})));
    check('hash rejection blocks worker and candidate',()=>{assert.equal(rejected.text,'');assert.equal(rejected.details.stages.worker,'NOT_RUN');assert.equal(rejected.details.state,'FAIL');});
    report.diagnostics.unhandledRejections=await step('promise diagnostics',()=>page.evaluate(()=>__unhandled));
    report.diagnostics.cspViolations=await step('CSP diagnostics',()=>page.evaluate(()=>__csp));
    check('no console/page/promise/CSP errors or external requests',()=>{for(const rows of Object.values(report.diagnostics))assert.deepEqual(rows,[]);});
  }finally{clearInterval(poll);}
}catch(error){report.fatal=String(error.stack??error);save();}
finally{
  if(browser){try{await step('browser disconnect/close',()=>browser.close(),5000);}catch(error){report.cleanupError=String(error);}}
  if(server){try{await step('browser process close',()=>server.close(),5000);}catch(error){report.cleanupError=String(error);stopOwned();}}
  clearTimeout(deadline);report.finished=new Date().toISOString();report.counts={pass:report.checks.filter(c=>c.state==='PASS').length,fail:report.checks.filter(c=>c.state==='FAIL').length,notRun:5-report.checks.length};save();
}
// End the isolated test process even if a failed library operation retained a handle.
process.exit(report.fatal||report.cleanupError||report.counts.fail?1:0);
