import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { homedir } from 'node:os';
import { createSnapshot } from '../../src/index.mjs';
import { hashCases } from './suite.mjs';

// Reuse the already-installed development tool; this runner never installs browsers/packages.
const moduleUrl=process.env.INHERITAGE_PLAYWRIGHT_MODULE
  ? pathToFileURL(resolve(process.env.INHERITAGE_PLAYWRIGHT_MODULE))
  : new URL('../../../../experiments/offline-ocr/node_modules/playwright/index.mjs',import.meta.url);
const {chromium}=await import(moduleUrl.href);
const root=resolve(fileURLToPath(new URL('../../',import.meta.url)));
const server=createServer(async(req,res)=>{
  try {
    const pathname=decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname);
    if(pathname==='/favicon.ico'){res.writeHead(204);res.end();return;}
    const path=resolve(root,pathname==='/'?'test/browser/index.html':`.${pathname}`);
    if(!path.startsWith(root+sep)||!['.html','.mjs','.json'].includes(extname(path))) {
      res.writeHead(403);res.end();return;
    }
    res.setHeader('Content-Type',extname(path)==='.html'?'text/html; charset=utf-8':extname(path)==='.json'?'application/json':'text/javascript');
    res.setHeader('Cache-Control','no-store');res.end(await readFile(path));
  } catch {res.writeHead(404);res.end();}
});
await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
const origin=`http://127.0.0.1:${server.address().port}`;
const expectedHashes=Object.fromEntries(hashCases().map(c=>[c.id,createSnapshot(c.input,c.approvals).dependencyHash]));
const edgeCandidates=[process.env.INHERITAGE_EDGE_EXECUTABLE,
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  `${homedir()}/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge`].filter(Boolean);
const edge=edgeCandidates.find(existsSync);
const targets=[{name:'Chromium'},...(edge?[{name:'Microsoft Edge',executablePath:edge}]:[])];
const report={node:process.version,origin,browsers:[],edge:edge?'INSTALLED':'NOT_RUN_NOT_INSTALLED_IN_STANDARD_PATHS'};
try {
  for(const target of targets){
    let browser;
    const consoleErrors=[],pageErrors=[],externalRequests=[],requests=[];
    try {
      browser=await chromium.launch({headless:true,chromiumSandbox:true,...(target.executablePath?{executablePath:target.executablePath}:{})});
      const context=await browser.newContext();
      await context.route('**/*',async route=>{
        const url=route.request().url();requests.push(url);
        if(new URL(url).origin!==origin){externalRequests.push(url);await route.abort();}
        else await route.continue();
      });
      const page=await context.newPage();
      page.on('console',message=>{if(message.type()==='error')consoleErrors.push(message.text());});
      page.on('pageerror',error=>pageErrors.push(error.message));
      await page.addInitScript(()=>{globalThis.__unhandled=[];addEventListener('unhandledrejection',e=>__unhandled.push(String(e.reason)));});
      await page.goto(origin,{waitUntil:'networkidle'});
      await page.evaluate(async()=>{globalThis.__runChecks=(await import('/test/browser/suite.mjs')).runBrowserChecks;});
      const boundary=requests.length;
      const result=await page.evaluate(hashes=>globalThis.__runChecks(hashes),expectedHashes);
      const unhandled=await page.evaluate(async()=>{await new Promise(r=>setTimeout(r,0));return globalThis.__unhandled;});
      const engineRequests=requests.slice(boundary);
      const diagnostics={consoleErrors,pageErrors,unhandledRejections:unhandled,externalRequests,engineRequests};
      const diagnosticsPass=Object.values(diagnostics).every(items=>items.length===0);
      report.browsers.push({name:target.name,version:browser.version(),...result,diagnostics,diagnosticsPass});
    } catch(error){report.browsers.push({name:target.name,fail:1,error:error.stack,consoleErrors,pageErrors,externalRequests});}
    finally{if(browser)await browser.close();}
  }
} finally {await new Promise(resolve=>server.close(resolve));}
console.log(JSON.stringify(report,null,2));
if(report.browsers.some(b=>b.fail>0||!b.diagnosticsPass))process.exitCode=1;
