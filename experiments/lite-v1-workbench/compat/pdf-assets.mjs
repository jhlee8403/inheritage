// Build-time boundary only: immutable official legacy bytes, no parser patches.
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
export const compatibility=JSON.parse(await readFile(new URL('manifest.json',import.meta.url)));
export async function pdfAsset(name){
 const entry=compatibility.files.find(f=>f.name===name);if(!entry)throw Error('UNLOCKED_COMPAT_RESOURCE: '+name);
 const bytes=await readFile(new URL('vendor/'+name,import.meta.url));
 if(bytes.length!==entry.bytes||createHash('sha256').update(bytes).digest('hex')!==entry.sha256)throw Error('COMPAT_RESOURCE_HASH_MISMATCH: '+name);
 return bytes;
}
export function classicLegacy(bytes){
 const text=bytes.toString(),match=text.match(/\n(?:\/\*+\/\s*)?export \{ ([\w, ]+) \};\s*(?:\/\*+\/\s*)?(?:\/\/# sourceMappingURL=[^\n]*)?\s*$/);
 if(!match)throw Error('LEGACY_EXPORT_SHAPE');
 const bindings=match[1].split(',').map(value=>{
  const m=value.trim().match(/^(\w+)(?: as (\w+))?$/);if(!m)throw Error('LEGACY_EXPORT_BINDING');
  return JSON.stringify(m[2]??m[1])+':'+m[1];
 });
 // Node-only import.meta references cannot execute in a browser; the PDF worker
 // is already preloaded, so the dynamic worker import path is not exercised.
 const body=text.slice(0,match.index).replaceAll('import.meta.url','"inline-pdfjs-legacy"');
 const asynchronous=body.includes('globalThis.pdfjsLib = await (globalThis.pdfjsLibPromise');
 return `(${asynchronous?'async ':''}()=>{${body}\nreturn {${bindings.join(',')}};})()`;
}
