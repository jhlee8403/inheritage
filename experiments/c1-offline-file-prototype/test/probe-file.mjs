import { chromium } from '../../offline-ocr/node_modules/playwright/index.mjs';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';
const edge = '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge';
const url = pathToFileURL(fileURLToPath(new URL('../../inheritance-calculator/index.html', import.meta.url))).href;
const report = { mode: 'original-development-page-file', url, browsers: [] };
for (const target of [{name:'Chromium'}, ...(existsSync(edge)?[{name:'Mac Microsoft Edge',executablePath:edge}]:[])]) {
  const browser = await chromium.launch({ headless:true, chromiumSandbox:true, ...(target.executablePath?{executablePath:target.executablePath}:{}) });
  try {
    const context = await browser.newContext({ serviceWorkers:'block', offline:true });
    const page = await context.newPage(), consoleErrors=[], pageErrors=[], requests=[], failedRequests=[];
    page.on('console', m=>{if(m.type()==='error')consoleErrors.push(m.text());});
    page.on('pageerror', e=>pageErrors.push(e.stack));
    page.on('request', r=>requests.push(r.url()));
    page.on('requestfailed', r=>failedRequests.push({url:r.url(),failure:r.failure()}));
    await page.goto(url, {waitUntil:'load'});
    await page.waitForTimeout(150);
    const observation = await page.evaluate(async()=>({
      secureContext:isSecureContext, subtle:typeof crypto?.subtle?.digest,
      sha256:crypto?.subtle?Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode('abc'))),b=>b.toString(16).padStart(2,'0')).join(''):null,
      clipboardWrite:typeof navigator.clipboard?.writeText,
      status:document.querySelector('#status')?.dataset.state??null,
      manualFields:document.querySelectorAll('[data-field]').length,
      localCssLoaded:Array.from(document.styleSheets).some(s=>s.href?.endsWith('style.css')),
    }));
    report.browsers.push({name:target.name,version:browser.version(),...observation,consoleErrors,pageErrors,requests,failedRequests});
  } finally { await browser.close(); }
}
console.log(JSON.stringify(report,null,2));
