// Development-time acquisition only. The browser never calls these URLs.
import { mkdir, cp, readFile, writeFile, readdir, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = fileURLToPath(new URL('../', import.meta.url));
const digest = data => createHash('sha256').update(data).digest('hex');
const modelRevision = '87416418657359cb625c412a48b6e1d6d41c29bd';
const fontRevision = '47d54ca1ebb14fd864695f1d39dc734f39017c33';
const downloads = [
  ...['kor', 'eng', 'chi_tra'].map(lang => ({
    name: `tessdata_fast/${lang}`, version: modelRevision, license: 'Apache-2.0',
    url: `https://raw.githubusercontent.com/tesseract-ocr/tessdata_fast/${modelRevision}/${lang}.traineddata`,
    target: `public/models/${lang}.traineddata`, role: 'OCR language data (LSTM only)',
  })),
  { name: 'tessdata_fast license', version: modelRevision, license: 'Apache-2.0', url: `https://raw.githubusercontent.com/tesseract-ocr/tessdata_fast/${modelRevision}/LICENSE`, target: 'public/models/LICENSE', role: 'license' },
  { name: 'Noto Sans KR', version: fontRevision, license: 'OFL-1.1', url: `https://raw.githubusercontent.com/google/fonts/${fontRevision}/ofl/notosanskr/NotoSansKR%5Bwght%5D.ttf`, target: '.cache/fonts/NotoSansKR.ttf', role: 'synthetic fixture generation only; PDF subset embedded' },
  { name: 'Noto Sans KR license', version: fontRevision, license: 'OFL-1.1', url: `https://raw.githubusercontent.com/google/fonts/${fontRevision}/ofl/notosanskr/OFL.txt`, target: 'fixtures/OFL-NotoSansKR.txt', role: 'embedded font license' },
];
await mkdir(path.join(root, 'results'), { recursive: true });
let previous;
try { previous = JSON.parse(await readFile(path.join(root, 'results/assets-manifest.json'), 'utf8')); } catch {}
const sources = [];
for (const entry of downloads) {
  const target = path.join(root, entry.target);
  await mkdir(path.dirname(target), { recursive: true });
  let data;
  try { data = await readFile(target); } catch {
    const response = await fetch(entry.url);
    if (!response.ok) throw new Error(`${entry.url}: HTTP ${response.status}`);
    data = Buffer.from(await response.arrayBuffer());
  }
  const hash = digest(data);
  const locked = previous?.sources.find(x => x.url === entry.url);
  if (locked && locked.sha256 !== hash) throw new Error(`Integrity mismatch: ${entry.target}`);
  await writeFile(target, data);
  sources.push({ ...entry, bytes: data.length, sha256: hash });
}
const copies = [
  ['pdfjs-dist/build/pdf.mjs', 'pdfjs/pdf.mjs'],
  ['pdfjs-dist/build/pdf.worker.mjs', 'pdfjs/pdf.worker.mjs'],
  ['pdfjs-dist/cmaps', 'pdfjs/cmaps'],
  ['pdfjs-dist/standard_fonts', 'pdfjs/standard_fonts'],
  ['pdfjs-dist/wasm', 'pdfjs/wasm'],
  ['pdfjs-dist/LICENSE', 'pdfjs/LICENSE'],
  ['tesseract.js/dist/tesseract.min.js', 'tesseract/tesseract.min.js'],
  ['tesseract.js/dist/worker.min.js', 'tesseract/worker.min.js'],
  ['tesseract.js/LICENSE.md', 'tesseract/LICENSE.md'],
];
for (const name of await readdir(path.join(root, 'node_modules/tesseract.js-core'))) {
  if (/\.(wasm|js)$/.test(name) || /license/i.test(name)) copies.push([`tesseract.js-core/${name}`, `tesseract-core/${name}`]);
}
for (const [source, target] of copies) {
  await mkdir(path.dirname(path.join(root, 'public/vendor', target)), { recursive: true });
  await cp(path.join(root, 'node_modules', source), path.join(root, 'public/vendor', target), { recursive: true });
}
async function inventory(dir) {
  const out = [];
  for (const name of (await readdir(path.join(root, dir))).sort()) {
    const relative = `${dir}/${name}`;
    if ((await stat(path.join(root, relative))).isDirectory()) out.push(...await inventory(relative));
    else { const data = await readFile(path.join(root, relative)); out.push({ path: relative, bytes: data.length, sha256: digest(data) }); }
  }
  return out;
}
const lock = JSON.parse(await readFile(path.join(root, 'package-lock.json'), 'utf8'));
const packages = [];
for (const [location, entry] of Object.entries(lock.packages)) {
  if (!location) continue;
  let installed;
  try { installed = JSON.parse(await readFile(path.join(root, location, 'package.json'), 'utf8')); } catch { continue; }
  const files = await inventory(location);
  packages.push({ name: installed.name, version: entry.version, license: installed.license ?? entry.license,
    officialSource: installed.repository, path: location, archiveURL: entry.resolved,
    npmIntegrity: entry.integrity, installedBytes: files.reduce((n, f) => n + f.bytes, 0),
    packageJsonSha256: digest(await readFile(path.join(root, location, 'package.json'))),
    licenseFiles: files.filter(f => /license|notice|copying/i.test(f.path)) });
}
const runtimeFiles = [...await inventory('public/vendor'), ...await inventory('public/models')];
await writeFile(path.join(root, 'results/assets-manifest.json'), JSON.stringify({
  schemaVersion: 1, sources, packages, runtimeFiles,
  runtimeBytes: runtimeFiles.reduce((n, f) => n + f.bytes, 0),
  note: 'Installed bytes are unpacked files; npm integrity is archive SHA-512. Runtime file SHA-256 is listed separately. No model is committed.',
}, null, 2) + '\n');
console.log(`Prepared ${runtimeFiles.length} local runtime assets; ${sources.length} pinned downloads.`);
