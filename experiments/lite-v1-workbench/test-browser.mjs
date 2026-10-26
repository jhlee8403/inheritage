import {pathToFileURL} from 'node:url';
const playwrightModule=process.env.INHERITAGE_PLAYWRIGHT_MODULE?pathToFileURL(process.env.INHERITAGE_PLAYWRIGHT_MODULE):new URL('../offline-ocr/node_modules/playwright/index.mjs',import.meta.url);
const driver=await import(playwrightModule.href);
const chromium=driver.chromium??driver.default.chromium;
import {readFileSync,writeFileSync,appendFileSync,mkdirSync,existsSync} from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const probing=process.env.INHERITAGE_LITE_INIT_PROBE==='1';
const modernProbe=process.env.INHERITAGE_LITE_MODERN_PROBE==='1',removeApis=process.env.INHERITAGE_LITE_REMOVE_APIS==='1';
const {run}=await import(modernProbe?'./compat/modern-probe-suite.mjs':probing?'./test-initialization-suite.mjs':'./test-suite.mjs');
import {fileURLToPath} from 'node:url';
import {pollPage} from './compat/poll-page.mjs';
const target=process.argv[2]??'chromium';
if(!['chromium','edge','chromium104'].includes(target))throw new Error('Use chromium, edge or chromium104');
const old104=fileURLToPath(new URL('generated/edge104-dev/chromium104/chrome-mac/Chromium.app/Contents/MacOS/Chromium',import.meta.url));
const edge='/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge';
const root=new URL('../../',import.meta.url);
const clean=value=>String(value).replaceAll(root.href,'<repo>/').replaceAll(decodeURI(root.pathname),'<repo>/');
const resultDir=process.env.INHERITAGE_LITE_RESULTS??'results/';
const prefix=modernProbe?'modern-probe-':removeApis?'api-removed-':probing?'initialization-':'';
const artifactUrl=new URL(modernProbe?'generated/edge104-dev/modern-probe.html':'generated/lite-v1.html',import.meta.url);
const out=new URL(`${resultDir}${prefix}${target}.json`,import.meta.url),log=new URL(`${resultDir}${prefix}${target}.jsonl`,import.meta.url);
mkdirSync(new URL(resultDir,import.meta.url),{recursive:true});
const report={playwrightModule:playwrightModule.href,target,started:new Date().toISOString(),windows:'NOT_RUN',offline:'fresh context, empty cache, browser offline emulation; physical disconnection NOT_RUN',checks:[],stages:[],diagnostics:{consoleErrors:[],pageErrors:[],externalRequests:[],unhandledRejections:[],cspViolations:[]}};
const save=()=>writeFileSync(out,clean(JSON.stringify(report,null,2))+'\n');
const emit=(stage,state,extra={})=>{const row={time:new Date().toISOString(),stage,state,...extra};report.stages.push(row);appendFileSync(log,clean(JSON.stringify(row))+'\n');save();console.log(JSON.stringify(row));};
let server,browser,ownedPid,mainPage;
const stopOwned=()=>{if(ownedPid){try{process.kill(ownedPid,'SIGKILL');report.killedOwnBrowserPid=ownedPid;}catch(error){if(error.code!=='ESRCH')report.killError=String(error);}}};
// Absolute process deadline also bounds Playwright teardown. Only the browser PID
// returned by this run's BrowserServer is eligible for the emergency signal.
const deadline=setTimeout(()=>{report.fatal='TIMEOUT: absolute test deadline 180000ms';emit('absolute deadline','TIMEOUT');stopOwned();save();process.exit(1);},180000);
async function step(name,action,ms=10000){
  emit(name,'START');let timer;
  try{const value=await Promise.race([Promise.resolve().then(action),new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error(`TIMEOUT: ${name} ${ms}ms`)),ms);})]);emit(name,'PASS');return value;}
  catch(error){emit(name,/timeout/i.test(String(error))?'TIMEOUT':'FAIL',{error:String(error)});throw error;}
  finally{clearTimeout(timer);}
}
async function check(name,fn,ms=15000){try{await step(name,fn,ms);report.checks.push({name,state:'PASS'});}catch(error){report.checks.push({name,state:'FAIL',error:String(error)});throw error;}finally{save();}}
try{
  const artifact=readFileSync(artifactUrl),build=JSON.parse(readFileSync(new URL(modernProbe?'results/edge104/modern-probe-build.json':'results/build.json',import.meta.url))),locked=JSON.parse(readFileSync(new URL('compat/manifest.json',import.meta.url)));
  report.artifact={sha256:createHash('sha256').update(artifact).digest('hex'),bytes:artifact.length,pdfjs:modernProbe?build.pdfjs:build.versions.pdfjs};
  assert.equal(report.artifact.sha256,build.sha256,'stale HTML');if(!modernProbe)assert.equal(build.versions.pdfjs,locked.pdfjsVersion,'stale PDF version');
  if(target==='edge'&&!existsSync(edge))throw new Error('EDGE_NOT_INSTALLED');
  server=await step('browser launch',()=>chromium.launchServer({headless:true,chromiumSandbox:true,timeout:20000,...(target==='edge'?{executablePath:edge}:target==='chromium104'?{executablePath:old104}:{})}),25000);
  ownedPid=server.process().pid;report.browserPid=ownedPid;
  browser=await step('browser connect',()=>chromium.connect(server.wsEndpoint(),{timeout:10000}));report.version=browser.version();
  const context=await step('fresh offline context',()=>browser.newContext({offline:true,serviceWorkers:'block'}));
  report.requests=[];context.on('request',r=>{report.requests.push(r.url());if(/^https?:/.test(r.url()))report.diagnostics.externalRequests.push(r.url());});
  await step('request guard',()=>context.route('**/*',r=>/^https?:/.test(r.request().url())?r.abort():r.continue()));
  const page=await step('page creation',()=>context.newPage());mainPage=page;page.setDefaultTimeout(10000);
  report.consoleWarnings=[];page.on('console',m=>{if(m.type()==='error')report.diagnostics.consoleErrors.push(m.text());else if(m.type()==='warning')report.consoleWarnings.push(m.text());});
  page.on('pageerror',e=>report.diagnostics.pageErrors.push(String(e)));
  if(removeApis)await step('remove modern APIs in isolated test context',()=>page.addInitScript(()=>{delete globalThis.Iterator;delete Promise.withResolvers;delete Promise.try;delete Map.prototype.getOrInsertComputed;delete URL.parse;delete Uint8Array.prototype.toHex;delete Uint8Array.fromBase64;delete Math.sumPrecise;delete ReadableStream.prototype[Symbol.asyncIterator];}));
  await step('diagnostic hooks',()=>page.addInitScript(()=>{
    globalThis.__unhandled=[];globalThis.__csp=[];globalThis.__held=[];
    const digest=crypto.subtle.digest.bind(crypto.subtle);
    crypto.subtle.digest=(...args)=>{
      if(globalThis.__rejectNextHash){__rejectNextHash=false;return Promise.reject(Error('synthetic hash rejection'));}
      const real=digest(...args);if(!globalThis.__holdNextHash)return real;__holdNextHash=false;
      return new Promise((resolve,reject)=>__held.push(()=>real.then(resolve,reject)));
    };
    globalThis.__workerCount=0;globalThis.__blobCount=0;
    const NativeWorker=Worker;globalThis.Worker=class extends NativeWorker{
      constructor(...args){super(...args);__workerCount++;this.__counted=true;}
      terminate(){if(this.__counted){__workerCount--;this.__counted=false;}return super.terminate();}
    };
    const urls=new Set(),create=URL.createObjectURL.bind(URL),revoke=URL.revokeObjectURL.bind(URL);
    URL.createObjectURL=obj=>{const url=create(obj);urls.add(url);__blobCount=urls.size;return url;};
    URL.revokeObjectURL=url=>{urls.delete(url);__blobCount=urls.size;return revoke(url);};
    addEventListener('unhandledrejection',e=>__unhandled.push(String(e.reason)));
    addEventListener('securitypolicyviolation',e=>__csp.push({directive:e.violatedDirective,blocked:e.blockedURI}));
  }));
  await step('file HTML load',()=>page.goto(artifactUrl.href,{waitUntil:'load',timeout:15000}),17000);
  if(!probing){await step('PDF initialization completion',()=>pollPage(page,()=>/READY|FAILED|TIMEOUT/.test(document.querySelector('#pdf-init-status').textContent),null,{timeout:12000}),14000);}
  report.initialization=await step('initial state capture',()=>page.evaluate(()=>({pdf:document.querySelector('#pdf-init-status').textContent,c1:document.querySelector('#c1-init-status').textContent,details:document.querySelector('#pdf-details').textContent})));
  await run(page,check,report,browser);
  report.diagnostics.unhandledRejections=await step('promise diagnostics',()=>page.evaluate(()=>__unhandled));
  report.diagnostics.cspViolations=await step('CSP diagnostics',()=>page.evaluate(()=>__csp));
  await check('zero external requests and console/page/promise/CSP errors',()=>{for(const rows of Object.values(report.diagnostics))assert.deepEqual(rows,[]);});
  await step('screenshot',()=>page.screenshot({path:fileURLToPath(new URL(`generated/${prefix}${target}.png`,import.meta.url)),fullPage:true}));

}catch(error){report.fatal=String(error.stack??error);if(mainPage){try{report.failureState=await step('failure state capture',()=>mainPage.evaluate(()=>({status:document.querySelector('#pdf-status').textContent,details:document.querySelector('#pdf-details').textContent,canvas:(()=>{const c=document.querySelector('#pdf-canvas');if(!c.width||!c.height)return null;const bytes=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let dark=0;for(let i=0;i<bytes.length;i+=4)if(bytes[i+3]>0&&bytes[i]+bytes[i+1]+bytes[i+2]<600)dark++;return {width:c.width,height:c.height,dark};})()})),2000);}catch{}try{await mainPage.locator('#pdf-canvas').screenshot({path:fileURLToPath(new URL('generated/failure-'+target+'.png',import.meta.url)),timeout:2000});}catch{}}save();}
finally{
  if(browser){try{await step('browser disconnect/close',()=>browser.close(),5000);}catch(error){report.cleanupError=String(error);}}
  if(server){try{await step('browser process close',()=>server.close(),5000);}catch(error){report.cleanupError=String(error);stopOwned();}}
  clearTimeout(deadline);report.finished=new Date().toISOString();report.counts={pass:report.checks.filter(c=>c.state==='PASS').length,fail:report.checks.filter(c=>c.state==='FAIL').length,notRun:(modernProbe?3:probing?9:25)-report.checks.length};save();
}
// End the isolated test process even if a failed library operation retained a handle.
process.exit(report.fatal||report.cleanupError||report.counts.fail?1:0);
