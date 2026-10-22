import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {startServer} from '../scripts/server.mjs';
const moduleUrl=process.env.INHERITAGE_PLAYWRIGHT_MODULE ? pathToFileURL(resolve(process.env.INHERITAGE_PLAYWRIGHT_MODULE)) : new URL('../../offline-ocr/node_modules/playwright/index.mjs',import.meta.url);
const {chromium}=await import(moduleUrl.href);
const edge=process.env.INHERITAGE_EDGE_EXECUTABLE ?? '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge';
const targets=[{name:'Chromium'},...(existsSync(edge)?[{name:'Mac Microsoft Edge',executablePath:edge}]:[])];
const host=await startServer();
const report={node:process.version,edge:existsSync(edge)?edge:'NOT_RUN_NOT_INSTALLED',browsers:[]};
try {
  for(const target of targets) {
    let browser;
    const checks=[],diagnostics={consoleErrors:[],pageErrors:[],unhandledRejections:[],externalRequests:[]};
    try {
      browser=await chromium.launch({headless:true,chromiumSandbox:true,...(target.executablePath?{executablePath:target.executablePath}:{})});
      const context=await browser.newContext({viewport:{width:1280,height:900},permissions:['clipboard-read','clipboard-write']});
      await context.route('**/*',async route=>{
        const url=route.request().url();
        if(new URL(url).origin!==host.origin) {diagnostics.externalRequests.push(url);await route.abort();}
        else await route.continue();
      });
      const page=await context.newPage();
      page.on('console',m=>{if(m.type()==='error')diagnostics.consoleErrors.push(m.text());});
      page.on('pageerror',e=>diagnostics.pageErrors.push(e.stack));
      await page.addInitScript(()=>{
        globalThis.__unhandled=[];
        addEventListener('unhandledrejection',e=>__unhandled.push(String(e.reason)));
        // Hold only the completion of the real Web Crypto digest, never substitute results.
        const digest=crypto.subtle.digest.bind(crypto.subtle);
        globalThis.__heldHashes=[];
        crypto.subtle.digest=(...args)=>{
          if(globalThis.__failNextHash){globalThis.__failNextHash=false;return Promise.reject(new Error('synthetic hash failure'));}
          const real=digest(...args);
          if(!globalThis.__holdNextHash)return real;
          globalThis.__holdNextHash=false;
          const index=__heldHashes.length;
          return new Promise((resolve,reject)=>{__heldHashes[index]=()=>real.then(resolve,reject);});
        };
      });
      await page.goto(`${host.origin}/experiments/inheritance-calculator/index.html`,{waitUntil:'networkidle'});
      const field=path=>page.locator(`[data-field="${path}"]`);
      const state=async expected=>page.waitForFunction(value=>document.querySelector('#status').dataset.state===value,expected,{timeout:5000});
      const load=async type=>page.locator(`[data-sample="${type}"]`).click();
      const calculate=async(expected='REVIEW_READY')=>{await page.locator('#calculate').click();await state(expected);};
      const text=()=>page.locator('#output').inputValue();
      const result=async()=>{const output=await text();return JSON.parse(output.slice(output.indexOf('\n{\n')+1));};
      const shares=r=>r.allocations.map(a=>[a.personId,`${a.relativeShare.numerator}/${a.relativeShare.denominator}`,`${a.wholeShare.numerator}/${a.wholeShare.denominator}`,a.pathIds]);
      const check=async(name,fn)=>{try{await fn();checks.push({name,pass:true});}catch(error){checks.push({name,pass:false,error:error.stack});}process.stderr.write(`${target.name}: ${name}: ${checks.at(-1).pass?'PASS':'FAIL'}\n`);};
      const empty=async()=>{
        assert.equal(await text(),'');assert.equal(await page.locator('#output').isHidden(),true);
        assert.equal(await page.locator('#copy').isDisabled(),true);assert.equal(await page.locator('#select').isDisabled(),true);
      };
      await check('blank manual fields remain UNKNOWN and empty',async()=>{
        assert.equal(await field('asset.share.numerator').inputValue(),'');
        for(const path of ['asset.review','event.deathOrder','family.complete','family.spouse.existence','family.children.complete','scopeFacts.renunciation'])assert.equal(await field(path).inputValue(),'UNKNOWN');
        await empty();
      });
      // Literal independent expectations; the test never calls the engine to generate answers.
      for(const [type,rule,expected] of [
        ['spouse','BL1-R01',[['W','3/7','3/7',['E1:A:W:DIRECT']],['C1','2/7','2/7',['E1:A:C1:DIRECT']],['C2','2/7','2/7',['E1:A:C2:DIRECT']]]],
        ['parents','BL1-R02',[['W','3/7','3/7',['E1:A:W:DIRECT']],['F','2/7','2/7',['E1:A:F:DIRECT']],['M','2/7','2/7',['E1:A:M:DIRECT']]]],
        ['children','BL1-R03',[['C1','1/3','1/3',['E1:A:C1:DIRECT']],['C2','1/3','1/3',['E1:A:C2:DIRECT']],['C3','1/3','1/3',['E1:A:C3:DIRECT']]]]
      ]) await check(`${type} fixture: people, fractions, paths, rules and checks`,async()=>{
        await load(type);await calculate();const r=await result();assert.deepEqual(shares(r),expected);
        assert(r.provenance.appliedRules.some(item=>item.id===rule&&item.version==='v1'));
        assert.equal(r.provenance.lawSnapshotId,'BL1-LAW-2016-14409');assert.deepEqual(r.unresolved,[]);
        assert.equal(r.checks.conservation.ok,true);assert.equal(r.checks.identityPaths.ok,true);
        assert((await text()).includes('실제 권리 확정 아님'));
      });
      await check('Q edit immediately clears result and copy before any hash completes; recalculation',async()=>{
        await load('spouse');await calculate();
        const immediate=await page.evaluate(()=>{
          const input=document.querySelector('[data-field="asset.share.denominator"]');input.value='3';input.dispatchEvent(new Event('input',{bubbles:true}));
          return {state:document.querySelector('#status').dataset.state,output:document.querySelector('#output').value,copy:document.querySelector('#copy').disabled};
        });assert.deepEqual(immediate,{state:'STALE',output:'',copy:true});await empty();
        await calculate();assert.deepEqual(shares(await result()).map(row=>row.slice(0,3)),[['W','3/7','1/7'],['C1','2/7','2/21'],['C2','2/7','2/21']]);
      });
      await check('add/remove family member requires explicit confirmation; new ID and Q',async()=>{
        await load('children');await calculate();await page.locator('[data-remove="children:2"]').click();await empty();
        assert.equal(await field('family.children.complete').inputValue(),'UNKNOWN');await calculate('BLOCKED');
        await field('family.children.complete').selectOption('CONFIRMED');await calculate();
        assert.deepEqual(shares(await result()).map(row=>row.slice(0,3)),[['C1','1/2','1/2'],['C2','1/2','1/2']]);
        await page.locator('[data-add="children"]').click();assert.equal(await field('family.children.members.2.id').inputValue(),'');
        assert.equal(await field('family.children.members.2.life').inputValue(),'UNKNOWN');
        await field('family.children.members.2.id').fill('FabricatedNew');
        await field('family.children.members.2.life').selectOption('ALIVE');
        for(const key of ['adult','review','relationshipReview'])await field(`family.children.members.2.${key}`).selectOption('CONFIRMED');
        await field('family.children.complete').selectOption('CONFIRMED');await field('asset.share.numerator').fill('2');await field('asset.share.denominator').fill('5');await calculate();
        assert.deepEqual(shares(await result()).map(row=>row.slice(0,3)),[['C1','1/3','2/15'],['C2','1/3','2/15'],['FabricatedNew','1/3','2/15']]);
      });
      await check('UNKNOWN spouse: BLOCKED, unresolved Q, no allocations; blocked text copyable',async()=>{
        await load('spouse');await field('asset.share.denominator').fill('3');await field('family.spouse.existence').selectOption('UNKNOWN');await calculate('BLOCKED');
        const r=await result();assert.deepEqual(r.allocations,[]);assert.deepEqual(r.paths,[]);
        assert.deepEqual(r.unresolved[0].wholeShare,{numerator:'1',denominator:'3'});assert(r.blockedReasons.some(b=>b.field==='family.spouse.existence'));
        assert((await text()).includes('법률상 지분 0을 의미하지 않습니다'));await page.locator('#copy').click();
        assert.equal(await page.evaluate(()=>navigator.clipboard.readText()),await text());
      });
      await check('incomplete family: BLOCKED preserves Q',async()=>{
        await load('parents');await field('family.parents.complete').selectOption('UNKNOWN');await calculate('BLOCKED');const r=await result();
        assert(r.blockedReasons.some(b=>b.field==='family.parents.complete'));assert.deepEqual(r.allocations,[]);assert.deepEqual(r.unresolved[0].wholeShare,{numerator:'1',denominator:'1'});
      });
      await check('malformed, zero-denominator and negative Q: ERROR and no old output',async()=>{
        for(const [numerator,denominator,code,errorField] of [['bad','1','INVALID_INTEGER_STRING','asset.share.numerator'],['1','0','NONPOSITIVE_DENOMINATOR','fraction.denominator'],['-1','2','NEGATIVE_SHARE','fraction.numerator']]){
          await load('spouse');await calculate();await field('asset.share.numerator').fill(numerator);await field('asset.share.denominator').fill(denominator);await calculate('ERROR');await empty();
          const message=await page.locator('#status').textContent();assert(message.includes(code));assert(message.includes(errorField));
        }
      });
      const hold=()=>page.evaluate(()=>{globalThis.__holdNextHash=true;return __heldHashes.length;});
      const held=async index=>page.waitForFunction(i=>typeof __heldHashes[i]==='function',index);
      const release=index=>page.evaluate(async i=>{await __heldHashes[i]();await new Promise(r=>setTimeout(r,25));},index);
      await check('input changes during pending calculation: old completion ignored',async()=>{
        await load('spouse');const index=await hold();await page.locator('#calculate').click();await held(index);await state('CALCULATING');await empty();
        await field('asset.share.denominator').fill('3');await state('STALE');await release(index);await state('STALE');await empty();
        await calculate();assert.equal((await result()).allocations[0].wholeShare.denominator,'7');
      });
      await check('overlapping calculations: newer result wins even when older completes last',async()=>{
        await load('spouse');const index=await hold();await page.locator('#calculate').click();await held(index);
        await field('asset.share.denominator').fill('3');await calculate();const latest=await text();
        await release(index);assert.equal(await text(),latest);await state('REVIEW_READY');
      });
      await check('cancel pending calculation cannot resurrect previous success',async()=>{
        await load('spouse');await calculate();const index=await hold();await page.locator('#calculate').click();await held(index);
        await page.locator('#cancel').click();await state('CANCELLED');await release(index);await state('CANCELLED');await empty();
      });
      await check('hash failure is ERROR, caught, and removes previous successful output',async()=>{
        await load('spouse');await calculate();await page.evaluate(()=>{globalThis.__failNextHash=true;});await calculate('ERROR');await empty();
        assert((await page.locator('#status').textContent()).includes('HASH_FAILED'));
      });
      await check('latest result real clipboard copy and selection; clipboard denial fallback',async()=>{
        await load('children');await calculate();await page.locator('#copy').click();
        assert.equal(await page.evaluate(()=>navigator.clipboard.readText()),await text());
        await page.locator('#select').click();assert.equal(await page.locator('#output').evaluate(e=>e.selectionEnd-e.selectionStart), (await text()).length);
        await page.evaluate(()=>{globalThis.__clipboardWrite=navigator.clipboard.writeText.bind(navigator.clipboard);navigator.clipboard.writeText=()=>Promise.reject(new Error('synthetic permission denial'));});
        await page.locator('#copy').click();await page.waitForFunction(()=>document.querySelector('#copy-note').textContent.includes('자동 복사가 허용되지'));
        assert.equal(await page.locator('#output').evaluate(e=>e.selectionEnd-e.selectionStart),(await text()).length);
        await page.evaluate(()=>{navigator.clipboard.writeText=globalThis.__clipboardWrite;});
      });
      await check('person ID HTML payload remains text and is rejected as invalid ID',async()=>{
        await load('spouse');const payload='<img src="https://example.invalid/x" onerror="globalThis.__injected=true">';
        await field('family.children.members.0.id').fill(payload);await calculate('ERROR');
        assert.equal(await page.evaluate(()=>globalThis.__injected),undefined);assert.equal(await page.locator('#facts img').count(),0);
        assert.equal(await field('family.children.members.0.id').inputValue(),payload);assert((await page.locator('#status').textContent()).includes('INVALID_ID'));await empty();
      });
      await check('pending clipboard completion cannot restore copy permission after an edit',async()=>{
        await load('spouse');await calculate();
        await page.evaluate(()=>{globalThis.__clipboardOriginal=navigator.clipboard.writeText.bind(navigator.clipboard);navigator.clipboard.writeText=()=>new Promise(resolve=>{globalThis.__releaseClipboard=resolve;});});
        await page.locator('#copy').click();await page.waitForFunction(()=>typeof globalThis.__releaseClipboard==='function');
        await field('asset.share.denominator').fill('3');await empty();
        await page.evaluate(async()=>{globalThis.__releaseClipboard();await new Promise(r=>setTimeout(r,0));navigator.clipboard.writeText=globalThis.__clipboardOriginal;});
        await empty();assert.equal(await page.locator('#copy-note').textContent(),'');
      });
      await check('date scope visible and fixed; new blank never retains old result',async()=>{
        assert((await page.locator('header').textContent()).includes('2017-01-10'));assert((await page.locator('header').textContent()).includes('BL1-LAW-2016-14409'));
        await load('spouse');await calculate();await page.locator('#blank').click();await empty();assert.equal(await field('family.spouse.existence').inputValue(),'UNKNOWN');
      });
      await check('recalculation resets previous output selection and scroll to the new result heading',async()=>{
        await load('spouse');await calculate();await page.locator('#select').click();
        await field('asset.share.denominator').fill('3');await calculate();
        assert.deepEqual(await page.locator('#output').evaluate(e=>[e.selectionStart,e.selectionEnd,e.scrollTop]),[0,0,0]);
      });
      await load('spouse');await calculate();
      if(target.executablePath)await page.screenshot({path:'/private/tmp/inheritage-manual-edge.png',fullPage:true});
      diagnostics.unhandledRejections=await page.evaluate(()=>globalThis.__unhandled);
      report.browsers.push({name:target.name,version:browser.version(),pass:checks.filter(c=>c.pass).length,fail:checks.filter(c=>!c.pass).length,skipped:0,checks,diagnostics,diagnosticsPass:Object.values(diagnostics).every(a=>a.length===0)});
    } catch(error) {report.browsers.push({name:target.name,fail:1,error:error.stack,diagnostics});}
    finally {if(browser)await browser.close();}
  }
} finally {await host.close();}
console.log(JSON.stringify(report,null,2));
if(report.browsers.some(b=>b.fail || !b.diagnosticsPass))process.exitCode=1;
