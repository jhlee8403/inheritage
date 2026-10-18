// Historical diagnostic: against the fixed source this records no render error.
import {chromium} from 'playwright';
import {createServer} from './server.mjs';
import {writeFile} from 'node:fs/promises';
const server=createServer();await new Promise(r=>server.listen(4173,'127.0.0.1',r));
const browser=await chromium.launch({headless:true,chromiumSandbox:true});
try {
  const page=await browser.newPage();await page.goto('http://127.0.0.1:4173');
  await page.waitForFunction(()=>window.spike);
  await page.locator('#file').setInputFiles('fixtures/scan-only.pdf');
  await page.waitForFunction(()=>!window.spike.state().busy);
  const result=await page.evaluate(()=>({errors:window.spike.snapshot().executionErrors,status:document.querySelector('#status').textContent}));
  await writeFile('results/current-render-probe.json',JSON.stringify(result,null,2)+'\n');
  console.log(result);
} finally {await browser.close();await new Promise(r=>server.close(r));}
