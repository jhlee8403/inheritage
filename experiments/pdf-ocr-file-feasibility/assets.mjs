import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
export const ocrRoot=new URL('../offline-ocr/',import.meta.url);
export const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');
export const manifest=JSON.parse(await readFile(new URL('results/assets-manifest.json',ocrRoot),'utf8'));
export async function verified(path) {
  const entry=manifest.runtimeFiles.find(e=>e.path===path);
  if(!entry)throw new Error(`No locked asset: ${path}`);
  const bytes=await readFile(new URL(path,ocrRoot));
  if(bytes.length!==entry.bytes||sha256(bytes)!==entry.sha256)throw new Error(`Integrity mismatch: ${path}`);
  return bytes;
}
export async function audit() {
  const failures=[];
  for(const entry of manifest.runtimeFiles){try{await verified(entry.path);}catch(e){failures.push({path:entry.path,error:e.message});}}
  const selected=manifest.runtimeFiles.filter(e=>/pdfjs\/(pdf\.mjs|pdf\.worker\.mjs|LICENSE)$|tesseract\/(tesseract.min.js|worker.min.js|LICENSE.md)$|tesseract-core\/tesseract-core-simd-lstm\.wasm(?:\.js)?$|models\//.test(e.path));
  return {schemaVersion:1,sourceBranch:'spike/offline-ocr',sourceCommit:'513439d7b3d4eb901e4318737bfeef71c57b5177',
    runtimeFiles:manifest.runtimeFiles.length,runtimeBytes:manifest.runtimeFiles.reduce((n,e)=>n+e.bytes,0),
    verified:manifest.runtimeFiles.length-failures.length,failures,selected,
    modelSources:manifest.sources.filter(e=>e.name.startsWith('tessdata_fast')),
    packages:manifest.packages.filter(e=>['pdfjs-dist','tesseract.js','tesseract.js-core'].includes(e.name)).map(e=>({name:e.name,version:e.version,license:e.license,archiveURL:e.archiveURL,npmIntegrity:e.npmIntegrity,installedBytes:e.installedBytes})),
    note:'Read-only SHA-256 audit of existing local resources. No acquisition, repairs or downloads.'};
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
  const result=await audit();await mkdir(new URL('results/',import.meta.url),{recursive:true});
  await writeFile(new URL('results/assets-audit.json',import.meta.url),JSON.stringify(result,null,2)+'\n');
  console.log(JSON.stringify({verified:result.verified,files:result.runtimeFiles,bytes:result.runtimeBytes,failures:result.failures}));
  if(result.failures.length)process.exitCode=1;
}
