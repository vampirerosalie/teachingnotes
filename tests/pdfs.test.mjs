import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {getDocument} from '../dist/assets/vendor/pdf.mjs';
import {materials} from '../dist/materials.js';
for(const m of materials.filter(m=>m.type==='pdf')){
 const task=getDocument({data:new Uint8Array(readFileSync(new URL('../dist/assets/materials/'+m.file,import.meta.url))),useSystemFonts:true,cMapUrl:fileURLToPath(new URL('../dist/assets/vendor/cmaps/',import.meta.url)),cMapPacked:true,standardFontDataUrl:fileURLToPath(new URL('../dist/assets/vendor/standard_fonts/',import.meta.url))});
 const doc=await task.promise;assert.ok(doc.numPages>0);
 for(let p=1;p<=doc.numPages;p++){const page=await doc.getPage(p);assert.ok(page.getViewport({scale:1}).width>0);await page.getOperatorList()}
 console.log(`PASS: ${m.original}: all ${doc.numPages} pages parsed.`);await task.destroy();
}
