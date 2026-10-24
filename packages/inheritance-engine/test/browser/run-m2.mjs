import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {resolve,extname,sep} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {createM2SnapshotAsync} from '../../src/m2.mjs';
import {canonicalM2} from '../../src/m2/snapshot-internal.mjs';
import {m2Input} from '../m2/fixtures.mjs';
const input=m2Input(),snapshot=await createM2SnapshotAsync(input);
const expectedHash=createHash('sha256').update(canonicalM2({input,dependencies:snapshot.dependencies})).digest('hex');
const moduleUrl=process.env.INHERITAGE_PLAYWRIGHT_MODULE?pathToFileURL(resolve(process.env.INHERITAGE_PLAYWRIGHT_MODULE)):new URL('../../../../experiments/offline-ocr/node_modules/playwright/index.mjs',import.meta.url);
const {chromium}=await import(moduleUrl.href);
const root=resolve(fileURLToPath(new URL('../../',import.meta.url)));
const host=createServer(async(req,res)=>{
  try {
    const url=new URL(req.url,'http://127.0.0.1');
    if(url.pathname==='/'){res.setHeader('Content-Type','text/html');res.end('<!doctype html><title>M2 safety gate test</title><link rel="icon" href="data:,">');return;}
    const path=resolve(root,`.${decodeURIComponent(url.pathname)}`);
    if(!path.startsWith(root+sep)||extname(path)!=='.mjs'){res.writeHead(403);res.end();return;}
    res.setHeader('Content-Type','text/javascript');res.end(await readFile(path));
  }catch{res.writeHead(404);res.end();}
});
await new Promise((resolve,reject)=>{host.once('error',reject);host.listen(0,'127.0.0.1',resolve);});
const origin=`http://127.0.0.1:${host.address().port}`;
const edge=process.env.INHERITAGE_EDGE_EXECUTABLE??'/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge';
const report={node:process.version,edge:existsSync(edge)?edge:'NOT_RUN_NOT_INSTALLED',browsers:[]};
try {
  for(const target of [{name:'Chromium'},...(existsSync(edge)?[{name:'Mac Microsoft Edge',executablePath:edge}]:[])]) {
    let browser;const diagnostics={consoleErrors:[],pageErrors:[],unhandledRejections:[],externalRequests:[],calculationRequests:[]};
    try {
      browser=await chromium.launch({headless:true,chromiumSandbox:true,...(target.executablePath?{executablePath:target.executablePath}:{})});
      const context=await browser.newContext(),requests=[];
      await context.route('**/*',async route=>{const url=route.request().url();requests.push(url);if(new URL(url).origin!==origin){diagnostics.externalRequests.push(url);await route.abort();}else await route.continue();});
      const page=await context.newPage();page.on('console',m=>{if(m.type()==='error')diagnostics.consoleErrors.push(m.text());});page.on('pageerror',e=>diagnostics.pageErrors.push(e.stack));
      await page.addInitScript(()=>{globalThis.__unhandled=[];addEventListener('unhandledrejection',e=>__unhandled.push(String(e.reason)));});
      await page.goto(origin);await page.evaluate(async()=>{
        globalThis.__m2Checks=(await import('/test/browser/m2-suite.mjs')).runM2Checks;
        globalThis.__m2SnapshotChecks=(await import('/test/browser/m2-snapshot-suite.mjs')).runM2SnapshotChecks;
      });
      const boundary=requests.length;const result=await page.evaluate(async expected=>{
        const s0=await globalThis.__m2Checks(),s1=await globalThis.__m2SnapshotChecks(expected);
        return {results:[...s0.results,...s1.results],pass:s0.pass+s1.pass,fail:s0.fail+s1.fail,skipped:s0.skipped+s1.skipped,s0:{pass:s0.pass,fail:s0.fail},s1:{pass:s1.pass,fail:s1.fail}};
      },expectedHash);
      diagnostics.unhandledRejections=await page.evaluate(()=>globalThis.__unhandled);diagnostics.calculationRequests=requests.slice(boundary);
      report.browsers.push({name:target.name,version:browser.version(),...result,diagnostics,diagnosticsPass:Object.values(diagnostics).every(a=>a.length===0)});
    }catch(error){report.browsers.push({name:target.name,fail:1,error:error.stack,diagnostics});}
    finally{if(browser)await browser.close();}
  }
}finally{await new Promise(resolve=>host.close(resolve));}
console.log(JSON.stringify(report,null,2));if(report.browsers.some(b=>b.fail||!b.diagnosticsPass))process.exitCode=1;
