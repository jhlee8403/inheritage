import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {pollPage} from './compat/poll-page.mjs';
export async function run(page,check,report){
  const waitFor=(predicate,arg,options)=>report.target==='chromium104'?pollPage(page,predicate,arg,options):page.waitForFunction(predicate,arg,options);
  const original=new URL('../offline-ocr/fixtures/',import.meta.url),generated=new URL('generated/fixtures/',import.meta.url);
  const el=id=>page.locator('#pdf-'+id),field=path=>page.locator(`[data-field="${path}"]`);
  const pdfState=async value=>{await waitFor(v=>{const s=document.querySelector('#pdf-status').textContent;return s.startsWith(v)||/^(ERROR|TIMEOUT|INIT_ERROR)/.test(s);},value,{timeout:45000});assert((await el('status').textContent()).startsWith(value),await el('status').textContent());};
  const idle=()=>waitFor(()=>JSON.parse(document.querySelector('#pdf-details').textContent).pendingCleanup===0&&!document.querySelector('#pdf-ocr').disabled,null,{timeout:5000});
  const select=async(name,base=original)=>{await el('file').setInputFiles(fileURLToPath(new URL(name,base)));await pdfState('NEEDS_REVIEW');await idle();};
  const details=async()=>JSON.parse(await el('details').textContent());
  const ocr=async()=>{await el('ocr').click();await pdfState('NEEDS_REVIEW');await idle();};
  const c1state=value=>waitFor(v=>document.querySelector('#status').dataset.state===v,value,{timeout:5000});
  const calc=async(value='REVIEW_READY')=>{await page.locator('#calculate').click();await c1state(value);};
  const result=async()=>{const t=await page.locator('#output').inputValue();return JSON.parse(t.slice(t.indexOf('\n{\n')+1));};
  await check('selected text PDF, render and direct NEEDS_REVIEW',async()=>{
    await select('text-only.pdf');assert.equal(await el('page').textContent(),'1 / 1');assert((await el('direct').inputValue()).includes('가온새'));assert(await el('canvas').evaluate(c=>c.width>0&&c.height>0));assert.equal(await el('original').inputValue(),'');
  });
  await check('selected scan PDF, real Blob/WASM/kor OCR candidate',async()=>{
    await select('scan-only.pdf');assert.equal((await el('direct').inputValue()).trim(),'');await ocr();
    assert(await el('canvas').evaluate(c=>{const data=c.getContext('2d').getImageData(0,0,c.width,c.height).data;for(let i=0;i<data.length;i+=4)if(data[i+3]&&data[i]+data[i+1]+data[i+2]<600)return true;return false;}),'scan must render real nonwhite pixels');
    const text=await el('original').inputValue();assert(/[가-힣]/.test(text));assert.equal(await el('edited').inputValue(),text);report.ocr={candidate:text,diagnostics:await details()};
    for(const stage of ['BLOB_WORKER_BOOTED','RESOURCE_MESSAGE_RECEIVED','CORE_FACTORY_ENTERED','WASM_BYTES_SUPPLIED','WASM_RUNTIME_READY','KOR_BYTES_SUPPLIED'])assert(report.ocr.diagnostics.events.some(e=>e.stage===stage),stage);
    assert.equal(report.ocr.diagnostics.cleanup.state,'PASS');
  },45000);
  await check('user candidate editing and quality warning, no C1 auto-fill',async()=>{
    const facts=await page.locator('[data-field]').evaluateAll(nodes=>nodes.map(n=>[n.dataset.field,n.value]));await el('edited').fill('가공 수정 후보 - 원문 대조 필요');assert.equal(await el('edited').inputValue(),'가공 수정 후보 - 원문 대조 필요');assert.deepEqual(await page.locator('[data-field]').evaluateAll(nodes=>nodes.map(n=>[n.dataset.field,n.value])),facts);assert((await el('quality').textContent()).includes('32.84%'));assert((await el('quality').textContent()).includes('인명 누락'));
  });
  await check('replacement clears previous document candidate',async()=>{await select('text-only.pdf');assert.equal(await el('original').inputValue(),'');assert(!(await el('edited').inputValue()).includes('가공 수정 후보'));});
  await check('three-page selected PDF navigation and per-page edited candidate',async()=>{
    await select('three-pages.pdf',generated);assert.equal(await el('page').textContent(),'1 / 3');await el('edited').fill('PAGE ONE EDIT');
    await el('next').click();await pdfState('NEEDS_REVIEW');await idle();assert.equal(await el('page').textContent(),'2 / 3');assert.equal((await el('direct').inputValue()).trim(),'');assert.equal(await el('edited').inputValue(),'');
    await el('prev').click();await pdfState('NEEDS_REVIEW');await idle();assert.equal(await el('edited').inputValue(),'PAGE ONE EDIT');
  });
  await check('PDF markup remains literal text, no HTML execution',async()=>{
    await el('next').click();await pdfState('NEEDS_REVIEW');await idle();await el('next').click();await pdfState('NEEDS_REVIEW');await idle();assert((await el('direct').inputValue()).includes('<script>'));assert.equal(await page.evaluate(()=>globalThis.__pdfInjected),undefined);assert.equal(await page.locator('img[src=x]').count(),0);
  });
  await check('OCR cancellation after actual worker boot and cleanup',async()=>{
    await select('scan-only.pdf');await page.evaluate(()=>{const observer=new MutationObserver(()=>{if(document.querySelector('#pdf-details').textContent.includes('BLOB_WORKER_BOOTED')){observer.disconnect();document.querySelector('#pdf-cancel').click();}});observer.observe(document.querySelector('#pdf-details'),{childList:true});});
    await el('ocr').click();await pdfState('CANCELLED');await idle();await page.waitForTimeout(250);assert.equal(await el('original').inputValue(),'');assert.equal(await el('edited').inputValue(),'');
  });
  await check('navigation blocks held late OCR completion',async()=>{
    await select('three-pages.pdf',generated);await el('next').click();await pdfState('NEEDS_REVIEW');await idle();
    await page.evaluate(()=>{__holdNextHash=true;});await el('ocr').click();await waitFor(()=>__held.length>0);
    await el('next').click();await pdfState('NEEDS_REVIEW');await idle();const before=await el('edited').inputValue();await page.evaluate(()=>__held.shift()());await page.waitForTimeout(100);assert.equal(await el('edited').inputValue(),before);assert.equal(await el('page').textContent(),'3 / 3');
  });
  await check('PDF replacement blocks held old OCR completion',async()=>{
    await select('scan-only.pdf');await page.evaluate(()=>{__holdNextHash=true;});await el('ocr').click();await waitFor(()=>__held.length>0);
    await select('text-only.pdf');await page.evaluate(()=>__held.shift()());await page.waitForTimeout(100);assert.equal(await el('original').inputValue(),'');assert((await el('direct').inputValue()).includes('가온새'));
  });
  await check('explicit OCR error clears candidate and releases resources',async()=>{
    await select('scan-only.pdf');await page.evaluate(()=>{__rejectNextHash=true;});await el('ocr').click();await pdfState('ERROR');await idle();assert.equal(await el('original').inputValue(),'');assert.equal(await el('edited').inputValue(),'');assert((await el('status').textContent()).includes('synthetic hash rejection'));
  });
  await check('OCR pipeline hash TIMEOUT, late result cannot publish',async()=>{
    await page.evaluate(()=>{__holdNextHash=true;});await el('ocr').click();await waitFor(()=>__held.length>0);await pdfState('TIMEOUT');await idle();assert.equal(await el('original').inputValue(),'');await page.evaluate(()=>__held.shift()());await page.waitForTimeout(100);assert.equal(await el('original').inputValue(),'');assert((await el('status').textContent()).startsWith('TIMEOUT'));
  },12000);
  await check('malformed PDF explicit ERROR',async()=>{await el('file').setInputFiles({name:'broken.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.7\n broken fixture')});await pdfState('ERROR');assert.equal(await el('direct').inputValue(),'');});
  await check('file byte limit explicit ERROR before parsing',async()=>{await el('file').setInputFiles({name:'large.pdf',mimeType:'application/pdf',buffer:Buffer.alloc(8*1024*1024+1)});await pdfState('ERROR');assert((await el('status').textContent()).includes('FILE_SIZE_LIMIT'));});
  await check('page count limit explicit ERROR',async()=>{await el('file').setInputFiles(fileURLToPath(new URL('too-many.pdf',generated)));await pdfState('ERROR');assert((await el('status').textContent()).includes('PAGE_LIMIT'));});
  await check('render pixel limit explicit ERROR before canvas allocation',async()=>{await el('file').setInputFiles(fileURLToPath(new URL('too-large-page.pdf',generated)));await pdfState('ERROR');assert((await el('status').textContent()).includes('PIXEL_LIMIT'));assert.equal(await el('canvas').evaluate(c=>c.width*c.height),0);assert(await el('ocr').isDisabled());assert(await el('edited').isDisabled());});
  for(const [sample,rule,expected] of [['spouse','BL1-R01',[['W','3','7'],['C1','2','7'],['C2','2','7']]],['parents','BL1-R02',[['W','3','7'],['F','2','7'],['M','2','7']]],['children','BL1-R03',[['C1','1','3'],['C2','1','3'],['C3','1','3']]]])await check('integrated C1 '+sample,async()=>{
    await page.locator(`[data-sample=${sample}]`).click();await calc();const r=await result();assert.deepEqual(r.allocations.map(a=>[a.personId,a.wholeShare.numerator,a.wholeShare.denominator]),expected);assert(r.provenance.appliedRules.some(x=>x.id===rule));assert.equal(r.checks.identityPaths.ok,true);assert.equal(r.checks.conservation.ok,true);
  });
  await check('C1 exact Q, immediate STALE and copy disabled',async()=>{await field('asset.share.denominator').fill('3');await c1state('STALE');assert.equal(await page.locator('#output').inputValue(),'');assert(await page.locator('#copy').isDisabled());await calc();assert.deepEqual((await result()).allocations[0].wholeShare,{numerator:'1',denominator:'9'});});
  await check('C1 UNKNOWN BLOCKED preserves Q',async()=>{await page.locator('[data-sample=spouse]').click();await field('family.spouse.existence').selectOption('UNKNOWN');await calc('BLOCKED');const r=await result();assert.deepEqual(r.allocations,[]);assert.equal(r.unresolved[0].wholeShare.numerator,'1');});
  await check('C1 denominator zero ERROR, no old result or copy',async()=>{await page.locator('[data-sample=spouse]').click();await calc();await field('asset.share.denominator').fill('0');await calc('ERROR');assert.equal(await page.locator('#output').inputValue(),'');assert(await page.locator('#copy').isDisabled());});
  await check('C1 late async calculation blocked by edited revision',async()=>{
    await page.locator('[data-sample=spouse]').click();await page.evaluate(()=>{__holdNextHash=true;});await page.locator('#calculate').click();await waitFor(()=>__held.length>0);await field('asset.share.denominator').fill('3');await calc();const text=await page.locator('#output').inputValue();await page.evaluate(()=>__held.shift()());await page.waitForTimeout(100);assert.equal(await page.locator('#output').inputValue(),text);
  });
  await check('C1 clipboard attempt and manual selection fallback',async()=>{
    await page.locator('#copy').click();await waitFor(()=>document.querySelector('#copy-note').textContent.length>0);report.clipboardObservation=await page.locator('#copy-note').textContent();await page.locator('#select').click();assert.equal(await page.locator('#output').evaluate(e=>e.selectionEnd-e.selectionStart),(await page.locator('#output').inputValue()).length);
    await page.evaluate(()=>{navigator.clipboard.writeText=()=>Promise.reject(Error('synthetic denial'));});await page.locator('#copy').click();await waitFor(()=>document.querySelector('#copy-note').textContent.includes('자동 복사가 허용되지'));assert((await page.locator('#copy-note').textContent()).includes('Ctrl+C'));
  });
  await check('document close clears source, candidates and owned workers',async()=>{
    await el('close').click();await pdfState('EMPTY');await waitFor(()=>JSON.parse(document.querySelector('#pdf-details').textContent).pendingCleanup===0);assert.equal(await el('edited').inputValue(),'');assert.equal(await el('page').textContent(),'0 / 0');assert.equal(await page.evaluate(()=>__workerCount),0);assert.equal(await page.evaluate(()=>__blobCount),0);
  });
  await select('three-pages.pdf',generated);await el('next').click();await pdfState('NEEDS_REVIEW');await idle();await ocr();
}
