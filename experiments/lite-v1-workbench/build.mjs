import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {Script} from 'node:vm';
import {verified,manifest,sha256} from '../pdf-ocr-file-feasibility/assets.mjs';
const here=import.meta.url,root=new URL('../../',here);
const c1Manifest=JSON.parse(await readFile(new URL('../c1-offline-file-prototype/output/manifest.json',here)));
const c1=await readFile(new URL('../c1-offline-file-prototype/output/c1-calculator.html',here),'utf8');
if(sha256(c1)!==c1Manifest.outputs['c1-calculator.html'])throw Error('C1_OUTPUT_HASH_MISMATCH');
for(const source of c1Manifest.sources)if(sha256(await readFile(new URL(source.path,root)))!==source.sha256)throw Error('C1_SOURCE_MISMATCH: '+source.path);
const c1Script=c1.match(/<script>([\s\S]*)<\/script>/)?.[1],c1Style=c1.match(/<style>([\s\S]*?)<\/style>/)?.[1];
if(!c1Script||!c1Style)throw Error('C1_OUTPUT_SHAPE');
const paths={pdfjs:'public/vendor/pdfjs/pdf.mjs',pdfWorker:'public/vendor/pdfjs/pdf.worker.mjs',tesseract:'public/vendor/tesseract/tesseract.min.js',worker:'public/vendor/tesseract/worker.min.js',core:'public/vendor/tesseract-core/tesseract-core-simd-lstm.js',wasm:'public/vendor/tesseract-core/tesseract-core-simd-lstm.wasm',model:'public/models/kor.traineddata'};
const assets=Object.fromEntries(await Promise.all(Object.entries(paths).map(async([key,path])=>[key,await verified(path)])));
// Same restricted PDF.js classic packaging as the verified file POC, no new PDF engine.
function classic(bytes){const text=bytes.toString(),m=text.match(/\nexport \{ ([\w, ]+) \};\s*(?:\/\/# sourceMappingURL=[^\n]*)?\s*$/);if(!m)throw Error('PDFJS_EXPORT_SHAPE');return `(()=>{${text.slice(0,m.index).replaceAll('import.meta.url','"inline-pdfjs"')}\nreturn {${m[1]}};})()`;}
const adapter=await readFile(new URL('../kor-ocr-file-poc/worker-adapter.js',here),'utf8');
// Reuse the POC's exact fixed core factory adapter; fail if its shape changes.
const pocBuilder=await readFile(new URL('../kor-ocr-file-poc/build.mjs',here),'utf8');
const factory=pocBuilder.match(/const FixedCore=self\.TesseractCore;\n(self\.TesseractCore=[\s\S]*?);\n\$\{assets\.worker/);
if(!factory)throw Error('POC_CORE_FACTORY_SHAPE');
const worker=`${adapter}\n${assets.core}\nconst FixedCore=self.TesseractCore;\n${factory[1]};\n${assets.worker.toString().replace(/\/\/# sourceMappingURL=[^\n]*/g,'')}`;
new Script(worker);
const quote=value=>JSON.stringify(value).replaceAll('<','\u003c');
const resources=Object.fromEntries(['wasm','model'].map(key=>[key,{base64:assets[key].toString('base64'),sha256:sha256(assets[key])}]));
const app=await readFile(new URL('app.js',here),'utf8'),view=await readFile(new URL('pdf-panel.html',here),'utf8');
const initialization=await readFile(new URL('initialization.js',here),'utf8');
const pdfScript=`(()=>{'use strict';const init=window.__liteInitialization;
try{init.stage('pdf','PDF_WORKER_CODE');${classic(assets.pdfWorker)};
init.stage('pdf','PDF_JS_CODE');const pdfjs=${classic(assets.pdfjs)};
init.stage('pdf','TESSERACT_CODE');${assets.tesseract.toString().replace(/\/\/# sourceMappingURL=[^\n]*/g,'')}
init.stage('pdf','PDF_APP_LISTENERS');const WORKER_SOURCE=${quote(worker)},RESOURCES=${quote(resources)};
${app}
init.stage('pdf','PDF_APP_DIAGNOSTICS_COMPLETE');init.ready('pdf');
}catch(error){init.fail('pdf',error);}
})();`;
// C1 bytes remain unchanged in their own script. Tiny boundaries allow the
// independent bootstrap to diagnose a later payload's parse/CSP/runtime failure.
const scripts=[initialization,"window.__liteInitialization.start('c1');",c1Script,"if(document.getElementById('facts').childElementCount>0){window.__liteInitialization.ready('c1');}else{window.__liteInitialization.fail('c1','C1 초기 화면 생성 미확인');}","window.__liteInitialization.start('pdf');",pdfScript];
for(const source of scripts){new Script(source);if(/<\/script/i.test(source))throw Error('SCRIPT_BOUNDARY');}
const {createHash}=await import('node:crypto');
const scriptHashes=scripts.map(source=>createHash('sha256').update(source).digest('base64'));

const css=`${c1Style}\n.pdf-grid{display:grid;grid-template-columns:1fr 1fr;gap:1rem}.pdf-grid canvas{max-width:100%;height:auto;border:1px solid #999}.pdf-grid textarea{width:100%;height:8rem}.pdf-log{max-height:12rem;overflow:auto;white-space:pre-wrap}#pdf-edited{height:12rem}@media(max-width:800px){.pdf-grid{grid-template-columns:1fr}}`;
let body=c1.match(/<body>([\s\S]*)<script>/)?.[1];if(!body)throw Error('C1_BODY_SHAPE');
body=body.replace('<main>','<main>'+view).replace('C1 오프라인 파일 시제품','C1 수동 계산 영역').replace('C1 전용 file:// 시제품 · Windows Edge/업무 PC 미검증 · PDF/OCR 미포함','통합 시제품 · PDF 후보와 계산 입력은 독립 · Windows 통합 시험 미실시');
body=body.replace('<header>', '<p id="c1-init-status" role="status">C1 초기화: NOT_STARTED</p><details><summary>C1 초기화 진단</summary><pre id="c1-init-details" class="pdf-log">초기화 코드 실행 대기</pre></details><header>');
const csp=`default-src 'none'; script-src ${scriptHashes.map(hash=>"'sha256-"+hash+"'").join(' ')} 'wasm-unsafe-eval'; worker-src blob:; connect-src 'none'; style-src 'unsafe-inline'; img-src data: blob:; font-src data: blob:; object-src 'none'; base-uri 'none'; form-action 'none'`;
const html=`<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="${csp}"><title>축소형 통합 검증 화면</title><link rel="icon" href="data:,"><style>${css}</style></head><body>${body}${scripts.map(source=>'<script>'+source+'</script>').join('')}</body></html>`;
await mkdir(new URL('generated/',here),{recursive:true});
await writeFile(new URL('generated/lite-v1.html',here),html);
const notices=await Promise.all(['public/vendor/pdfjs/LICENSE','public/vendor/tesseract/LICENSE.md','public/vendor/tesseract-core/LICENSE','public/models/LICENSE'].map(verified));
await writeFile(new URL('generated/NOTICE.txt',here),Buffer.concat(notices));
const instructions=await readFile(new URL('WINDOWS_MANUAL_TEST.md',here),'utf8');
await writeFile(new URL('generated/Windows-시험안내.txt',here),instructions);
const record={instructionsSha256:sha256(instructions),notice:{bytes:Buffer.concat(notices).length,sha256:sha256(Buffer.concat(notices))},format:'lite-v1-integrated-v1',baseline:'ffb88aeac9582f700b1997fae40546c0becbd2b3',output:'generated/lite-v1.html',bytes:Buffer.byteLength(html),sha256:sha256(html),versions:{pdfjs:'6.4.299',tesseract:'7.0.0',core:'7.0.0'},c1OutputSha256:sha256(c1),c1ScriptSha256:sha256(c1Script),scripts:scriptHashes.map((hash,index)=>({index,cspSha256:hash,bytes:Buffer.byteLength(scripts[index])})),sources:{initialization:sha256(initialization),app:sha256(app),view:sha256(view),builder:sha256(await readFile(new URL(here))),workerAdapter:sha256(adapter),pocBuilder:sha256(pocBuilder)},resources:Object.entries(paths).map(([key,path])=>({key,path,bytes:assets[key].length,sha256:sha256(assets[key])})),modelSource:manifest.sources.find(e=>e.name==='tessdata_fast/kor'),c1Sources:c1Manifest.sources};
await writeFile(new URL('results/build.json',here),JSON.stringify(record,null,2)+'\n');console.log(JSON.stringify({bytes:record.bytes,sha256:record.sha256}));
