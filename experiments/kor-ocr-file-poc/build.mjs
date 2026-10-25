import { readFile,writeFile,mkdir } from 'node:fs/promises';
import { Script } from 'node:vm';
import { createHash } from 'node:crypto';
import { verified,manifest,ocrRoot,sha256 } from '../pdf-ocr-file-feasibility/assets.mjs';
const paths={pdfjs:'public/vendor/pdfjs/pdf.mjs',pdfWorker:'public/vendor/pdfjs/pdf.worker.mjs',
  tesseract:'public/vendor/tesseract/tesseract.min.js',worker:'public/vendor/tesseract/worker.min.js',
  core:'public/vendor/tesseract-core/tesseract-core-simd-lstm.js',wasm:'public/vendor/tesseract-core/tesseract-core-simd-lstm.wasm',model:'public/models/kor.traineddata'};
const assets=Object.fromEntries(await Promise.all(Object.entries(paths).map(async([key,path])=>[key,await verified(path)])));
const pdf=await readFile(new URL('fixtures/scan-only.pdf',ocrRoot));
const fixtureLock=JSON.parse(await readFile(new URL('results/fixture-manifest.json',ocrRoot),'utf8')).files.find(f=>f.path==='fixtures/scan-only.pdf');
if(sha256(pdf)!==fixtureLock.sha256)throw new Error('SCAN_FIXTURE_HASH_MISMATCH');
const quote=value=>JSON.stringify(value).replaceAll('<','\u003c');
function classic(bytes){let text=bytes.toString();const m=text.match(/\nexport \{ ([\w, ]+) \};\s*(?:\/\/# sourceMappingURL=[^\n]*)?\s*$/);if(!m)throw new Error('PDFJS_EXPORT_SHAPE');return `(()=>{${text.slice(0,m.index).replaceAll('import.meta.url','"inline-pdfjs"')}\nreturn {${m[1]}};})()`;}
const adapter=await readFile(new URL('worker-adapter.js',import.meta.url),'utf8');
const workerSource=`${adapter}\n${assets.core.toString()}\nconst FixedCore=self.TesseractCore;
self.TesseractCore=options=>{stage('CORE_FACTORY_ENTERED');return localResources.then(({wasm})=>{stage('WASM_BYTES_SUPPLIED');return FixedCore({...options,wasmBinary:wasm,locateFile:path=>{if(path!=='tesseract-core-simd-lstm.wasm')throw new Error('UNEXPECTED_CORE_FILE: '+path);return 'memory-wasm:/'+path;}});}).then(runtime=>{stage('WASM_RUNTIME_READY');return runtime;});};
${assets.worker.toString().replace(/\/\/# sourceMappingURL=[^\n]*/g,'')}`;
new Script(workerSource);
if(JSON.parse(quote(workerSource))!==workerSource)throw new Error('WORKER_SERIALIZATION_MISMATCH');
const app=await readFile(new URL('app.js',import.meta.url),'utf8');
const resources=Object.fromEntries(Object.entries({wasm:assets.wasm,model:assets.model,pdf}).map(([key,bytes])=>[key,{base64:bytes.toString('base64'),sha256:sha256(bytes)}]));
const script=`(()=>{'use strict';${classic(assets.pdfWorker)};const pdfjs=${classic(assets.pdfjs)};
${assets.tesseract.toString().replace(/\/\/# sourceMappingURL=[^\n]*/g,'')}
const WORKER_SOURCE=${quote(workerSource)},RESOURCES=${quote(resources)};\n${app}\n})();`;
new Script(script);if(/<\/script/i.test(script))throw new Error('SCRIPT_BOUNDARY');
const hash=createHash('sha256').update(script).digest('base64');
const html=`<!doctype html><html lang="ko"><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'sha256-${hash}' 'wasm-unsafe-eval'; worker-src blob:; connect-src 'none'; style-src 'unsafe-inline'; img-src data: blob:; font-src data: blob:; object-src 'none'; base-uri 'none'"><title>한국어 file OCR 실험</title><link rel="icon" href="data:,"><style>body{font:16px system-ui;margin:2rem;max-width:60rem}canvas{max-width:100%;border:1px solid #999}textarea{width:100%;height:12rem}pre{white-space:pre-wrap}</style><h1>고정 가공 스캔 1쪽 · 한국어 OCR 후보</h1><p>실제 사건 사용 불가 / 후보 NEEDS_REVIEW / 상속 사실 자동 확정 없음 / Windows OCR 미검증</p><button id="run">가공 스캔 OCR</button><button id="cancel">취소</button><p id="status">READY</p><canvas id="page"></canvas><textarea id="text" readonly aria-label="OCR 후보"></textarea><pre id="details"></pre><script>${script}</script></html>`;
await mkdir(new URL('generated/',import.meta.url),{recursive:true});await mkdir(new URL('results/',import.meta.url),{recursive:true});
await writeFile(new URL('generated/kor-ocr.html',import.meta.url),html);
await writeFile(new URL('generated/NOTICE.txt',import.meta.url),Buffer.concat([await verified('public/vendor/pdfjs/LICENSE'),await verified('public/vendor/tesseract/LICENSE.md'),await verified('public/vendor/tesseract-core/LICENSE'),await verified('public/models/LICENSE')]));
const record={format:'kor-file-ocr-poc-v1',output:'generated/kor-ocr.html',bytes:Buffer.byteLength(html),sha256:sha256(html),
  tesseractVersion:'7.0.0',coreVersion:'7.0.0',pdfjsVersion:'6.4.299',resources:Object.entries(paths).map(([key,path])=>({key,path,bytes:assets[key].length,sha256:sha256(assets[key])})),
  fixture:{...fixtureLock,originalPage:2},modelSource:manifest.sources.find(e=>e.name==='tessdata_fast/kor'),
  sourceHashes:{builder:sha256(await readFile(new URL('build.mjs',import.meta.url))),app:sha256(app),adapter:sha256(adapter)},
  note:'Generated complete file contains fixed worker/core/WASM/kor/scan resources; no runtime file or HTTP fetch. Large output deliberately gitignored.'};
await writeFile(new URL('results/build.json',import.meta.url),JSON.stringify(record,null,2)+'\n');console.log(JSON.stringify({bytes:record.bytes,sha256:record.sha256}));
