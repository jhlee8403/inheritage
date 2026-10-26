// Controlled non-deliverable reproduction: swap both PDF bundles to locked
// original modern 6.4.299 bytes; keep the independent initialization diagnostics.
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {Script} from 'node:vm';
import {verified,sha256} from '../../pdf-ocr-file-feasibility/assets.mjs';
import {pdfAsset,classicLegacy} from './pdf-assets.mjs';
const root=new URL('../',import.meta.url),html=await readFile(new URL('generated/lite-v1.html',root),'utf8');
const sources=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
const old=sources.slice(),inputs=[];
for(const [legacy,path] of [['pdf.worker.mjs','public/vendor/pdfjs/pdf.worker.mjs'],['pdf.mjs','public/vendor/pdfjs/pdf.mjs']]){
 const a=classicLegacy(await pdfAsset(legacy)),b=await verified(path);
 if(!sources[5].includes(a))throw Error('PROBE_SOURCE_SHAPE');
 sources[5]=sources[5].replace(a,()=>classicLegacy(b));inputs.push({path,sha256:sha256(b)});
}
sources[0]=sources[0].replace('4.2.67 official legacy (core-js 3.37.0); no extra runtime shims','6.4.299 modern controlled reproduction; not deliverable');
let output=html;
const sri=text=>createHash('sha256').update(text).digest('base64');
for(let i=0;i<sources.length;i++){
 new Script(sources[i]);output=output.replace('<script>'+old[i]+'</script>',()=>'<script>'+sources[i]+'</script>');
 output=output.replace("'sha256-"+sri(old[i])+"'","'sha256-"+sri(sources[i])+"'");
}
await writeFile(new URL('generated/edge104-dev/modern-probe.html',root),output);
await writeFile(new URL('results/edge104/modern-probe-build.json',root),JSON.stringify({pdfjs:'6.4.299',inputs,bytes:Buffer.byteLength(output),sha256:sha256(output),notDeliverable:true},null,2)+'\n');
