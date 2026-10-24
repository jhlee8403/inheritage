// Build-time helper only. No build tools are needed by the recipient.
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve, relative, dirname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { Script } from 'node:vm';
const root = fileURLToPath(new URL('../../../', import.meta.url));
const output = fileURLToPath(new URL('../output/', import.meta.url));
const view = 'experiments/inheritance-calculator/';
const entry = view + 'app.mjs', modules = new Map(), visiting = new Set(), sources = [];
const hash = text => createHash('sha256').update(text).digest('hex');
const sri = text => createHash('sha256').update(text).digest('base64');
const portableCopyText = text => text.replaceAll('⌘C', 'Edge의 복사 메뉴 또는 Ctrl+C (Mac: Command+C)');
async function read(id) {
  const source = await readFile(resolve(root, id), 'utf8');
  sources.push({ path:id, sha256:hash(source) }); return source;
}
function dependency(from, specifier) {
  if (!specifier.startsWith('./') && !specifier.startsWith('../')) throw new Error(`Nonlocal import: ${specifier}`);
  const id = relative(root, resolve(root, dirname(from), specifier)).split(sep).join('/');
  if (!(id.startsWith(view) || id.startsWith('packages/inheritance-engine/src/')) ||
      !id.endsWith('.mjs') || id.includes('/m2') || id.endsWith('/snapshot.mjs') || id.endsWith('/index.mjs')) throw new Error(`Unsupported module: ${id}`);
  return id;
}
function names(text) {
  if (!/^\s*\w+(?:\s+as\s+\w+)?(?:\s*,\s*\w+(?:\s+as\s+\w+)?)*\s*$/.test(text)) throw new Error(`Unsupported names: ${text}`);
  return text.split(',').map(s=>s.trim().split(/\s+as\s+/));
}
// Restricted, fail-closed linker for the current acyclic project source syntax.
// This is not a general JavaScript transpiler. Unsupported module forms abort.
async function bundle(id) {
  if (visiting.has(id)) throw new Error(`ES module cycle unsupported: ${id}`);
  if (modules.has(id)) return;
  visiting.add(id); const original = await read(id), localExports = [];
  let source = id===entry ? portableCopyText(original) : original;
  const lines = [];
  for (let line of source.split('\n')) {
    let m;
    if ((m=line.match(/^import (\{[^}]+\}|\* as \w+) from '([^']+)';$/))) {
      const dep=dependency(id,m[2]); await bundle(dep);
      const binding=m[1].startsWith('*')?m[1].slice(5):`{${names(m[1].slice(1,-1)).map(([a,b])=>b?`${a}:${b}`:a).join(',')}}`;
      line=`const ${binding}=__load(${JSON.stringify(dep)});`;
    } else if ((m=line.match(/^export (\*|\{[^}]+\}) from '([^']+)';$/))) {
      const dep=dependency(id,m[2]); await bundle(dep);
      line=m[1]==='*'?`Object.assign(__exports,__load(${JSON.stringify(dep)}));`:
        names(m[1].slice(1,-1)).map(([a,b])=>`__exports[${JSON.stringify(b??a)}]=__load(${JSON.stringify(dep)})[${JSON.stringify(a)}];`).join('\n');
    } else if ((m=line.match(/^export (?:async )?(?:function|class|const) (\w+)/))) {
      localExports.push(m[1]); line=line.replace(/^export /,'');
    } else if (/^\s*(?:import|export)\b/.test(line)) throw new Error(`Unsupported module syntax in ${id}: ${line}`);
    lines.push(line);
  }
  source=lines.join('\n');
  if (/\bimport\s*(?:\(|\.)/.test(source) || /<\/script/i.test(source)) throw new Error(`Unsupported dynamic import/inline script boundary: ${id}`);
  source += '\n'+localExports.map(n=>`__exports.${n}=${n};`).join('\n');
  modules.set(id, source); visiting.delete(id);
}
await bundle(entry);
const script=`(()=>{'use strict';\nconst __factories={\n${[...modules].map(([id,body])=>`${JSON.stringify(id)}:(__exports,__load)=>{\n// source: ${id}\n${body}\n}`).join(',\n')}\n};
const __cache=Object.create(null);
function __load(id){if(__cache[id])return __cache[id];const value=Object.create(null);__cache[id]=value;__factories[id](value,__load);return Object.freeze(value);}
__load(${JSON.stringify(entry)});
})();`;
new Script(script, { filename:'c1-file-bundle.js' });
const css=await read(view+'style.css');
if (/<\/style/i.test(css)) throw new Error('Unsupported style boundary');
let html=portableCopyText(await read(view+'index.html'));
const csp=`default-src 'none'; script-src 'sha256-${sri(script)}'; style-src 'sha256-${sri(css)}'; img-src data:; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'`;
html=html.replace('<meta charset="utf-8">', `<meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${csp}">`)
  .replace('<link rel="stylesheet" href="./style.css">', `<style>${css}</style>`)
  .replace('<script type="module" src="./app.mjs"></script>', `<script>${script}</script>`)
  .replace('<h1>가공 사례 계산 검증</h1>', '<h1>C1 오프라인 파일 시제품</h1>')
  .replace('개발 검증 화면 · OCR 분리 · Windows 배포 및 실제 업무 PC 검증 미실시', 'C1 전용 file:// 시제품 · Windows Edge/업무 PC 미검증 · PDF/OCR 미포함');
if (html.includes('type="module"') || /(?:src|href)="(?!data:)[^"]+"/.test(html)) throw new Error('External asset reference remains');
const instructions='C1 오프라인 파일 시제품 — 가공 자료 전용\n\n'+
  '1. c1-calculator.html을 Microsoft Edge로 여세요(연결 프로그램 선택 또는 Edge 창에 끌어 놓기).\n'+
  '2. 표본을 선택하고 현재 입력 계산을 누르세요. 결과 텍스트 선택 후 Edge 복사 메뉴 또는 Ctrl+C로 복사할 수 있습니다.\n'+
  '3. 변경 즉시 옛 결과는 제거됩니다. UNKNOWN은 부존재 확인이 아닙니다. 실제 사건자료는 입력하지 마세요.\n\n'+
  '실행에 Node.js, Python, npm, Git, 개발 서버나 인터넷 다운로드가 필요하지 않습니다.\n'+
  'Mac Chromium/Edge에서 검증하는 기술 시제품이며 Windows Edge와 업무 PC 검증은 별도 필요합니다.\n'+
  '파일 실행/JavaScript/Web Crypto가 정책으로 제한되면 사용을 중단하고 관리자에게 문의하세요. 보안을 완화하지 마세요.\n'+
  '개시일 2017-01-10 / 기준일 2017-01-11 / BL1-LAW-2016-14409 한정. R04/R05 PENDING. PDF/OCR 미포함.\n';
const manifest={format:'c1-file-prototype-v1',buildScript:'experiments/c1-offline-file-prototype/scripts/build.mjs',
  buildScriptSha256:hash(await readFile(fileURLToPath(import.meta.url),'utf8')),
  sourceBaseline:'3b94f4c52af7f98d4da38debbc9ef28edababb5a',
  sources:sources.sort((a,b)=>a.path.localeCompare(b.path,'en')),
  adaptations:['C1 source linked as private classic-script modules; no calculation rewrite','inline CSS/JS with CSP hashes','prototype title/footer and portable copy instructions'],
  modules:[...modules.keys()].sort(),outputs:{'c1-calculator.html':hash(html),'사용방법.txt':hash(instructions)}};
await mkdir(output,{recursive:true});
await writeFile(resolve(output,'c1-calculator.html'),html);
await writeFile(resolve(output,'사용방법.txt'),instructions);
await writeFile(resolve(output,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify({output:relative(root,output),modules:modules.size,htmlBytes:Buffer.byteLength(html),sha256:hash(html)},null,2));
