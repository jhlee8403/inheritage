import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { Script } from 'node:vm';
import { verified, ocrRoot, sha256 } from './assets.mjs';
const worker=await verified('public/vendor/pdfjs/pdf.worker.mjs'),main=await verified('public/vendor/pdfjs/pdf.mjs');
const pdf=await readFile(new URL('fixtures/text-only.pdf',ocrRoot));
const fixtureManifest=JSON.parse(await readFile(new URL('results/fixture-manifest.json',ocrRoot),'utf8'));
if(sha256(pdf)!==fixtureManifest.files.find(e=>e.path==='fixtures/text-only.pdf').sha256)throw new Error('Synthetic fixture hash mismatch');
function classic(bytes,label){
  let text=bytes.toString('utf8');const match=text.match(/\nexport \{ ([\w, ]+) \};\s*(?:\/\/# sourceMappingURL=[^\n]*)?\s*$/);
  if(!match)throw new Error(`Unsupported PDF.js export shape: ${label}`);
  text=text.slice(0,match.index).replaceAll('import.meta.url',JSON.stringify(`inline-pdfjs:${label}`));
  if(/<\/script/i.test(text))throw new Error('Inline script boundary');
  return `(()=>{${text}\nreturn {${match[1]}};})()`;
}
// PDF.js detects its preloaded WorkerMessageHandler and uses its main-thread path.
// Native worker success is NOT claimed. WASM/dynamic resource branches are unused.
const app=await readFile(new URL('direct-app.js',import.meta.url),'utf8');
const script=`(()=>{'use strict';\n${classic(worker,'pdf.worker.mjs')};\nconst pdfjs=${classic(main,'pdf.mjs')};\nconst PDF_BASE64=${JSON.stringify(pdf.toString('base64'))};\n${app}\n})();`;
new Script(script);
const scriptHash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(script));
const sri=Buffer.from(scriptHash).toString('base64');
const html=`<!doctype html><html lang="ko"><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'sha256-${sri}'; style-src 'unsafe-inline'; img-src data: blob:; font-src data: blob:; worker-src 'none'; connect-src 'none'; object-src 'none'; base-uri 'none'"><title>가공 PDF file 시험</title><link rel="icon" href="data:,"><style>body{font:16px system-ui;margin:2rem;max-width:60rem}canvas{max-width:100%;border:1px solid #999}textarea{width:100%;height:12rem}pre{white-space:pre-wrap}</style><h1>가공 PDF 직접 추출·첫 페이지 표시</h1><p>NEEDS_REVIEW 후보 / 실제 사건 사용 불가 / OCR·법률 계산 연결 없음</p><p>고정 text-only.pdf만 사용. 메인 스레드 처리이며 native worker·WASM 성공을 뜻하지 않습니다.</p><button id="run">가공 PDF 시험</button><p id="status">READY</p><canvas></canvas><textarea id="text" readonly aria-label="후보 텍스트"></textarea><pre id="details"></pre><script>${script}</script></html>`;
await mkdir(new URL('generated/',import.meta.url),{recursive:true});
await mkdir(new URL('results/',import.meta.url),{recursive:true});
await writeFile(new URL('generated/direct-text.html',import.meta.url),html);
await writeFile(new URL('generated/NOTICE.txt',import.meta.url),Buffer.concat([await verified('public/vendor/pdfjs/LICENSE'),Buffer.from('\nEmbedded synthetic PDF font license:\n'),await readFile(new URL('fixtures/OFL-NotoSansKR.txt',ocrRoot))]));
const result={format:'pdf-file-direct-trial-v1',output:'generated/direct-text.html',bytes:Buffer.byteLength(html),sha256:sha256(html),
  builderSha256:sha256(await readFile(new URL('build-direct.mjs',import.meta.url))),appSha256:sha256(app),
  fixture:{path:'experiments/offline-ocr/fixtures/text-only.pdf',bytes:pdf.length,sha256:sha256(pdf)},
  sources:[{path:'public/vendor/pdfjs/pdf.mjs',bytes:main.length,sha256:sha256(main)},{path:'public/vendor/pdfjs/pdf.worker.mjs',bytes:worker.length,sha256:sha256(worker)}],
  adaptation:'Static classic-script wrappers of locked PDF.js exports; import.meta.url replaced by inert labels in unused resource/Node branches; preloaded handler/main thread; no engine algorithm rewrite.',
  limits:'Fixed embedded synthetic PDF, first page only, no native worker/WASM/OCR/model loading, generated vendor-bearing HTML intentionally gitignored'};
await writeFile(new URL('results/direct-build.json',import.meta.url),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result,null,2));
