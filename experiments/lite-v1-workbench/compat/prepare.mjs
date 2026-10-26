// Explicit development preparation; the HTML builder never downloads resources.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {compatibility} from './pdf-assets.mjs';
const archive=new URL('../generated/edge104-dev/pdfjs-dist-4.2.67.tgz',import.meta.url),license=new URL('../generated/edge104-dev/core-js-3.37-LICENSE',import.meta.url);
if('sha512-'+createHash('sha512').update(await readFile(archive)).digest('base64')!==compatibility.npmIntegrity)throw Error('NPM_ARCHIVE_INTEGRITY_MISMATCH');
await mkdir(new URL('vendor/',import.meta.url),{recursive:true});
for(const entry of compatibility.files){
 const bytes=entry.packagePath?execFileSync('tar',['-xOf',fileURLToPath(archive),'package/'+entry.packagePath],{maxBuffer:8*1024*1024,timeout:10000}):await readFile(license);
 if(bytes.length!==entry.bytes||createHash('sha256').update(bytes).digest('hex')!==entry.sha256)throw Error('PREPARE_RESOURCE_HASH_MISMATCH: '+entry.name);
 await writeFile(new URL('vendor/'+entry.name,import.meta.url),bytes);
}
console.log('Verified official PDF.js 4.2.67 archive and all locked compatibility files.');
