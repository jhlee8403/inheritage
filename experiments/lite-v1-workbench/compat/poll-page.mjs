// Test-only polling from Node. Old Playwright's in-page predicate eval is
// rejected by the product CSP; never relax CSP or inject an eval replacement.
export async function pollPage(page,predicate,arg,options={}){
 const deadline=Date.now()+(options.timeout??10000);
 while(Date.now()<deadline){
  if(await page.evaluate(predicate,arg))return true;
  await new Promise(resolve=>setTimeout(resolve,25));
 }
 throw Error('TIMEOUT: test DOM predicate');
}
