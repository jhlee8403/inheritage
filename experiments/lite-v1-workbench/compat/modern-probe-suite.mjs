import assert from 'node:assert/strict';
import {pollPage} from './poll-page.mjs';
export async function run(page,check,report){
 await check('modern 6.4.299 reproduces Iterator failure before PDF app',async()=>{
  await pollPage(page,()=>document.querySelector('#pdf-init-status').textContent.includes('FAILED'));
  const text=await page.locator('#pdf-details').textContent();assert(text.includes('Iterator is not defined'));assert(text.includes('PDF_WORKER_CODE'));assert(await page.locator('#pdf-file').isDisabled());
 });
 await check('C1 still calculates exact shares with PDF initialization failed',async()=>{
  await page.locator('[data-sample=spouse]').click();await page.locator('#calculate').click();
  await pollPage(page,()=>document.querySelector('#status').dataset.state==='REVIEW_READY');
  const text=await page.locator('#output').inputValue(),r=JSON.parse(text.slice(text.indexOf('\n{\n')+1));
  assert.deepEqual(r.allocations.map(a=>[a.personId,a.wholeShare.numerator,a.wholeShare.denominator]),[['W','3','7'],['C1','2','7'],['C2','2','7']]);
 });
}
