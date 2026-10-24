import assert from 'node:assert/strict';
import { chromium } from '../../offline-ocr/node_modules/playwright/index.mjs';
import { mkdtemp, copyFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { sample } from '../../inheritance-calculator/fixtures.mjs';
import { APPROVALS } from '../../../packages/inheritance-engine/src/approval.mjs';
import { captureDependencies } from '../../../packages/inheritance-engine/src/snapshot-common.mjs';
const folder=await mkdtemp(join(tmpdir(),'C1 이동 시험 # ')), moved=join(folder,'계산 시제품.html');
await copyFile(new URL('../output/c1-calculator.html',import.meta.url),moved);
const fileUrl=pathToFileURL(moved).href, edge='/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge';
const report={mode:'relocated-single-file',node:process.version,emulatedNetworkOffline:true,
  freshNonpersistentContexts:true,clipboardPermissionOverrideInitially:false,windows:'NOT_RUN',browsers:[]};
const manifest=JSON.parse(await readFile(new URL('../output/manifest.json',import.meta.url),'utf8'));
report.htmlSha256=manifest.outputs['c1-calculator.html'];
const targets=[{name:'Chromium'},...(existsSync(edge)?[{name:'Mac Microsoft Edge',executablePath:edge}]:[])];
for(const target of targets.filter(t=>!process.env.INHERITAGE_FILE_BROWSER || (process.env.INHERITAGE_FILE_BROWSER==='edge'?!!t.executablePath:!t.executablePath))) {
  let browser;
  const checks=[],diagnostics={consoleErrors:[],pageErrors:[],unhandledRejections:[],externalRequests:[],otherResourceRequests:[],cspViolations:[]};
  try {
    browser=await chromium.launch({headless:true,chromiumSandbox:true,timeout:30000,...(target.executablePath?{executablePath:target.executablePath}:{})});
    const context=await browser.newContext({offline:true,serviceWorkers:'block',viewport:{width:1280,height:900}});
    const requests=[];
    await context.route('**/*',async route=>{const url=route.request().url();if(/^https?:/i.test(url)){diagnostics.externalRequests.push(url);await route.abort();}else await route.continue();});
    const page=await context.newPage();
    page.on('request',r=>{const url=r.url();requests.push(url);if(/^https?:/.test(url)&&!diagnostics.externalRequests.includes(url))diagnostics.externalRequests.push(url);if(url!==fileUrl&&!url.startsWith('data:'))diagnostics.otherResourceRequests.push(url);});
    page.on('console',m=>{if(m.type()==='error')diagnostics.consoleErrors.push(m.text());});
    page.on('pageerror',e=>diagnostics.pageErrors.push(e.stack));
    await page.addInitScript(()=>{
      globalThis.__unhandled=[];globalThis.__csp=[];
      addEventListener('unhandledrejection',e=>__unhandled.push(String(e.reason)));
      addEventListener('securitypolicyviolation',e=>__csp.push({directive:e.violatedDirective,blocked:e.blockedURI}));
      globalThis.__held=[];
      const original=crypto.subtle.digest.bind(crypto.subtle);
      crypto.subtle.digest=(...args)=>{
        if(globalThis.__failNext){globalThis.__failNext=false;return Promise.reject(new Error('synthetic hash failure'));}
        const real=original(...args);
        if(!globalThis.__holdNext)return real;
        globalThis.__holdNext=false;
        return new Promise((resolve,reject)=>{__held.push(async fail=>{if(fail)reject(new Error('synthetic late error'));else try{resolve(await real);}catch(e){reject(e);}});});
      };
    });
    await page.goto(fileUrl,{waitUntil:'load'});
    const field=p=>page.locator(`[data-field="${p}"]`), text=()=>page.locator('#output').inputValue();
    const state=value=>page.waitForFunction(v=>document.querySelector('#status').dataset.state===v,value,{timeout:5000});
    const load=type=>page.locator(`[data-sample="${type}"]`).click();
    const calculate=async(expected='REVIEW_READY')=>{await page.locator('#calculate').click();await state(expected);};
    const result=async()=>{const t=await text();return JSON.parse(t.slice(t.indexOf('\n{\n')+1));};
    const rows=r=>r.allocations.map(a=>[a.personId,`${a.relativeShare.numerator}/${a.relativeShare.denominator}`,`${a.wholeShare.numerator}/${a.wholeShare.denominator}`,a.pathIds]);
    const empty=async()=>{assert.equal(await text(),'');assert(await page.locator('#copy').isDisabled());assert(await page.locator('#select').isDisabled());};
    const check=async(name,action)=>{try{await action();checks.push({name,pass:true});}catch(error){checks.push({name,pass:false,error:error.stack});}};
    const hold=()=>page.evaluate(()=>{globalThis.__holdNext=true;return __held.length;});
    const held=i=>page.waitForFunction(n=>typeof __held[n]==='function',i);
    const release=(i,fail=false)=>page.evaluate(async({i,fail})=>{await __held[i](fail);await new Promise(r=>setTimeout(r,20));},{i,fail});
    await check('cold isolated offline file loads inline UI/CSS and Web Crypto without module requests',async()=>{
      await state('EMPTY');await empty();assert(await page.locator('[data-field]').count()>20);
      const environment=await page.evaluate(async()=>({secure:isSecureContext,protocol:location.protocol,
        sha256:Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode('abc'))),b=>b.toString(16).padStart(2,'0')).join(''),
        linkedStyles:document.querySelectorAll('link[rel=stylesheet]').length,inlineStyles:document.querySelectorAll('style').length,
        moduleScripts:document.querySelectorAll('script[type=module],script[src]').length}));
      assert.deepEqual(environment,{secure:true,protocol:'file:',sha256:'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',linkedStyles:0,inlineStyles:1,moduleScripts:0});
    });
    for(const [type,rule,expected] of [
      ['spouse','BL1-R01',[['W','3/7','3/7',['E1:A:W:DIRECT']],['C1','2/7','2/7',['E1:A:C1:DIRECT']],['C2','2/7','2/7',['E1:A:C2:DIRECT']]]],
      ['parents','BL1-R02',[['W','3/7','3/7',['E1:A:W:DIRECT']],['F','2/7','2/7',['E1:A:F:DIRECT']],['M','2/7','2/7',['E1:A:M:DIRECT']]]],
      ['children','BL1-R03',[['C1','1/3','1/3',['E1:A:C1:DIRECT']],['C2','1/3','1/3',['E1:A:C2:DIRECT']],['C3','1/3','1/3',['E1:A:C3:DIRECT']]]],
    ]) await check(`file normal ${type}: independent people/fractions/paths/rules`,async()=>{
      await load(type);await calculate();const r=await result();assert.deepEqual(rows(r),expected);
      assert(r.provenance.appliedRules.some(x=>x.id===rule&&x.version==='v1'));
      assert.equal(r.provenance.lawSnapshotId,'BL1-LAW-2016-14409');assert.deepEqual(r.unresolved,[]);
      assert(r.checks.conservation.ok&&r.checks.identityPaths.ok);
      // Hash comparison only: numerical expectations above remain independent literals.
      const originalInput=sample(type);originalInput.inputRevision=r.provenance.inputRevision;
      const expectedHash=createHash('sha256').update(captureDependencies(originalInput,APPROVALS).serialized).digest('hex');
      assert.equal((await text()).match(/SHA-256: ([a-f0-9]{64})/)[1],expectedHash);
    });
    await check('file input edit immediately clears old output and copy; exact Q recalculation',async()=>{
      await load('spouse');await calculate();
      const immediate=await page.evaluate(()=>{const e=document.querySelector('[data-field="asset.share.denominator"]');e.value='3';e.dispatchEvent(new Event('input',{bubbles:true}));return {status:document.querySelector('#status').dataset.state,text:document.querySelector('#output').value,copy:document.querySelector('#copy').disabled};});
      assert.deepEqual(immediate,{status:'STALE',text:'',copy:true});await empty();await calculate();
      assert.deepEqual(rows(await result()).map(r=>r.slice(0,3)),[['W','3/7','1/7'],['C1','2/7','2/21'],['C2','2/7','2/21']]);
    });
    await check('file UNKNOWN spouse BLOCKED preserves Q',async()=>{
      await load('spouse');await field('asset.share.denominator').fill('3');await field('family.spouse.existence').selectOption('UNKNOWN');await calculate('BLOCKED');
      const r=await result();assert.deepEqual(r.allocations,[]);assert.deepEqual(r.paths,[]);assert.deepEqual(r.unresolved[0].wholeShare,{numerator:'1',denominator:'3'});
      assert(r.blockedReasons.some(b=>b.field==='family.spouse.existence'));assert((await text()).includes('확정 배분 결과가 아닙니다'));
    });
    await check('file incomplete collection BLOCKED',async()=>{
      await load('parents');await field('family.parents.complete').selectOption('UNKNOWN');await calculate('BLOCKED');assert((await result()).blockedReasons.some(b=>b.field==='family.parents.complete'));
    });
    await check('file malformed, zero denominator and negative Q ERROR without old result',async()=>{
      for(const [n,d,code] of [['bad','1','INVALID_INTEGER_STRING'],['1','0','NONPOSITIVE_DENOMINATOR'],['-1','2','NEGATIVE_SHARE']]){
        await load('spouse');await calculate();await field('asset.share.numerator').fill(n);await field('asset.share.denominator').fill(d);await calculate('ERROR');await empty();assert((await page.locator('#status').textContent()).includes(code));
      }
    });
    await check('file pending calculation plus input edit blocks late result',async()=>{
      await load('spouse');const i=await hold();await page.locator('#calculate').click();await held(i);
      await field('asset.share.denominator').fill('3');await release(i);await state('STALE');await empty();
    });
    await check('file older async success/error cannot overwrite latest calculation',async()=>{
      for(const fail of [false,true]){
        await load('spouse');const i=await hold();await page.locator('#calculate').click();await held(i);
        await field('asset.share.denominator').fill('3');await calculate();const current=await text();await release(i,fail);assert.equal(await text(),current);await state('REVIEW_READY');
      }
    });
    await check('file cancel and hash failure never restore old result',async()=>{
      await load('spouse');await calculate();const i=await hold();await page.locator('#calculate').click();await held(i);await page.locator('#cancel').click();await release(i);await state('CANCELLED');await empty();
      await page.evaluate(()=>{globalThis.__failNext=true;});await calculate('ERROR');await empty();assert((await page.locator('#status').textContent()).includes('HASH_FAILED'));
    });
    let clipboardObservation;
    await check('file default clipboard attempt and manual full-text selection alternative',async()=>{
      await load('children');await calculate();await page.locator('#copy').click();
      await page.waitForFunction(()=>document.querySelector('#copy-note').textContent.length>0);
      clipboardObservation={defaultWriteNote:await page.locator('#copy-note').textContent(),readback:'NOT_RUN'};
      await page.locator('#select').click();assert.equal(await page.locator('#output').evaluate(e=>e.selectionEnd-e.selectionStart),(await text()).length);
      assert(!(await page.locator('#copy').isDisabled()));
    });
    await check('file explicit clipboard denial selects latest text with Windows-compatible instructions',async()=>{
      await page.evaluate(()=>{globalThis.__originalWrite=navigator.clipboard.writeText.bind(navigator.clipboard);navigator.clipboard.writeText=()=>Promise.reject(new Error('synthetic denial'));});
      try{
        await page.locator('#copy').click();await page.waitForFunction(()=>document.querySelector('#copy-note').textContent.includes('자동 복사가 허용되지'));
        assert((await page.locator('#copy-note').textContent()).includes('Ctrl+C'));
        assert.equal(await page.locator('#output').evaluate(e=>e.selectionEnd-e.selectionStart),(await text()).length);
      }finally{await page.evaluate(()=>{navigator.clipboard.writeText=__originalWrite;});}
    });
    await check('file delayed clipboard completion cannot restore stale copy permission',async()=>{
      await load('spouse');await calculate();await page.evaluate(()=>{globalThis.__write=navigator.clipboard.writeText.bind(navigator.clipboard);navigator.clipboard.writeText=()=>new Promise(resolve=>{globalThis.__releaseCopy=resolve;});});
      await page.locator('#copy').click();await page.waitForFunction(()=>typeof __releaseCopy==='function');await field('asset.share.denominator').fill('5');await empty();
      await page.evaluate(async()=>{__releaseCopy();await new Promise(r=>setTimeout(r,0));navigator.clipboard.writeText=__write;});await empty();assert.equal(await page.locator('#copy-note').textContent(),'');
    });
    await check('file HTML input is plain text and never executed or requested',async()=>{
      await load('spouse');await field('family.children.members.0.id').fill('<img src="https://example.invalid/" onerror="globalThis.__injected=true">');await calculate('ERROR');
      assert.equal(await page.locator('#facts img').count(),0);assert.equal(await page.evaluate(()=>globalThis.__injected),undefined);await empty();
    });
    await check('file page has fixed approved dates and no external references',async()=>{
      const header=await page.locator('header').textContent();assert(header.includes('2017-01-10')&&header.includes('2017-01-11')&&header.includes('BL1-LAW-2016-14409'));
      assert.equal(await page.locator('[src],[href]').evaluateAll(nodes=>nodes.filter(e=>![e.getAttribute('src'),e.getAttribute('href')].filter(Boolean).every(v=>v.startsWith('data:'))).length),0);
    });
    // Separate fresh file context: failure is explicit, not a weak or remote hash fallback.
    await check('file missing Web Crypto fails closed',async()=>{
      const denied=await browser.newContext({offline:true,serviceWorkers:'block'});
      try{await denied.addInitScript(()=>{
          globalThis.__unhandled=[];globalThis.__csp=[];
          addEventListener('unhandledrejection',e=>__unhandled.push(String(e.reason)));
          addEventListener('securitypolicyviolation',e=>__csp.push({directive:e.violatedDirective,blocked:e.blockedURI}));
          Object.defineProperty(globalThis,'crypto',{configurable:true,value:{}});
        });
        denied.on('request',r=>{const url=r.url();if(/^https?:/.test(url))diagnostics.externalRequests.push(url);if(url!==fileUrl&&!url.startsWith('data:'))diagnostics.otherResourceRequests.push(url);});
        const p=await denied.newPage();p.on('pageerror',e=>diagnostics.pageErrors.push(e.stack));
        p.on('console',m=>{if(m.type()==='error')diagnostics.consoleErrors.push(m.text());});await p.goto(fileUrl);
        await p.locator('[data-sample=spouse]').click();await p.locator('#calculate').click();
        await p.waitForFunction(()=>document.querySelector('#status').dataset.state==='ERROR');assert((await p.locator('#status').textContent()).includes('HASH_UNAVAILABLE'));assert.equal(await p.locator('#output').inputValue(),'');
        diagnostics.unhandledRejections.push(...await p.evaluate(()=>__unhandled));diagnostics.cspViolations.push(...await p.evaluate(()=>__csp));
      }finally{await denied.close();}
    });
    if(target.executablePath){await load('spouse');await calculate();await page.screenshot({path:'/private/tmp/inheritage-c1-file-edge.png',fullPage:true});}
    diagnostics.unhandledRejections.push(...await page.evaluate(()=>__unhandled));diagnostics.cspViolations.push(...await page.evaluate(()=>__csp));
    report.browsers.push({name:target.name,version:browser.version(),pass:checks.filter(c=>c.pass).length,fail:checks.filter(c=>!c.pass).length,skipped:0,checks,clipboardObservation,requests,diagnostics,diagnosticsPass:Object.values(diagnostics).every(a=>a.length===0)});
  }catch(error){report.browsers.push({name:target.name,fail:1,error:error.stack,diagnostics});}
  finally{if(browser)await browser.close();}
}
console.log(JSON.stringify(report,null,2));if(report.browsers.some(b=>b.fail||!b.diagnosticsPass))process.exitCode=1;
