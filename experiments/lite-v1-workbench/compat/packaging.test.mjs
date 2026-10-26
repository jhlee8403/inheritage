import test from 'node:test';
import assert from 'node:assert/strict';
import {runInNewContext} from 'node:vm';
import {classicLegacy,pdfAsset,compatibility} from './pdf-assets.mjs';
test('classic packaging preserves explicit export aliases',()=>{
 const text='const internalName=7;\nexport { internalName as publicName };\n';
 assert.equal(runInNewContext(classicLegacy(Buffer.from(text))).publicName,7);
});
test('4.2 asynchronous webpack startup is awaited, not stripped or treated as an identifier',async()=>{
 const text='var __webpack_exports__=Promise.resolve({version:"fixture"});\n__webpack_exports__ = globalThis.pdfjsLib = await (globalThis.pdfjsLibPromise = __webpack_exports__);\nvar internalVersion=__webpack_exports__.version;\n/******/ export { internalVersion as version };\n/******/\n';
 const result=await runInNewContext(classicLegacy(Buffer.from(text)));assert.equal(result.version,'fixture');
});
test('official PDF main and worker are the same locked version',async()=>{
 assert.equal(compatibility.pdfjsVersion,'4.2.67');
 for(const name of ['pdf.mjs','pdf.worker.mjs'])assert((await pdfAsset(name)).toString().includes('pdfjsVersion = "4.2.67"'));
});
