import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';
import {InkLayer} from '../dist/ink.js';
import {annotationTargets, nearestVisibleTarget} from '../dist/deck-annotations.js';

function domFor(name) {
  const html=readFileSync(new URL('../dist/assets/materials/'+name,import.meta.url),'utf8');
  return new JSDOM(html,{pretendToBeVisual:true});
}
// Existing HTML formats must all expose a page we can scribble on.
const examples=[
  ['f3-science-chapter1-practice-bilingual-v2.html','slide:'],
  ['f4-english-reading-ipad-v3.html','slide:'],
  ['f4-english-november-set01-reading.html','slide:'],
  ['f3-bi-email-writing-january-v4.html','screen:'],
];
for(const [file,prefix] of examples){
  const dom=domFor(file),d=dom.window.document;
  const slides=d.querySelectorAll('.slide');
  if(slides.length){slides[0].classList.add('active');}
  const items=annotationTargets(d);
  assert.ok(items.length>0,file+' must have an annotation surface');
  assert.ok(items[0].key.startsWith(prefix),file+' must use correct target family');
  assert.ok(items[0].element instanceof dom.window.Element);
  assert.ok(items[0].element.querySelector('.qcard,.mcq-card,.prompt-box,.box,.stimulus,.content') ||
    items[0].element.classList.contains('content'),file+' target must contain teaching material');
  dom.window.close();
}
// A multi-page deck must expose a distinct annotation layer for each sheet.
const pages=new JSDOM('<div id="deck"><section class="page">First</section><section class="page">Second</section></div>',{pretendToBeVisual:true});
const sheets=annotationTargets(pages.window.document);
assert.deepEqual(sheets.map(x=>x.key),['page:0','page:1']);
sheets[0].element.getBoundingClientRect=()=>({top:-1200,bottom:-400,width:1200,height:800});
sheets[1].element.getBoundingClientRect=()=>({top:0,bottom:800,width:1200,height:800});
assert.equal(nearestVisibleTarget(pages.window.document,sheets).key,'page:1');
pages.window.close();
// Old legacy HTML slides must still work.
const legacy=new JSDOM('<div id="position">1 / 12</div><main id="slide">Legacy page</main>');
assert.equal(annotationTargets(legacy.window.document)[0].key,'legacy-slide:1 / 12');
legacy.window.close();
// Finger drawing must be enabled without a hidden opt-in; Pencil still works.
const index=readFileSync(new URL('../dist/index.html',import.meta.url),'utf8');
const app=readFileSync(new URL('../dist/app.js',import.meta.url),'utf8');
assert.match(index,/id="fingerDraw" type="checkbox" checked/);
assert.match(app,/const settings=\{tool:'interact',color:'#[^']+',size:4,finger:true\}/);
assert.match(app,/annotationTargets\(d\)/);
assert.match(app,/setTool\(tool\)/);
// Exercise writing, marking and erasing on one attached HTML slide.
const smoke=new JSDOM('<main id="slide">Test content</main>',{pretendToBeVisual:true});
const d=smoke.window.document;
const settings={tool:'pen',color:'#ba315b',size:4,finger:true};
const layer=new InkLayer(d.querySelector('#slide'),()=>settings);
layer.svg.getBoundingClientRect=()=>({left:0,top:0,width:1000,height:1000});
layer.svg.setPointerCapture=()=>{};
layer.svg.releasePointerCapture=()=>{};
const ev=(x,y,type='touch')=>({
  pointerId:type==='pen'?2:1,pointerType:type,clientX:x,clientY:y,
  buttons:1,pressure:.5,preventDefault(){},stopPropagation(){}
});
layer.start(ev(100,120));layer.move(ev(200,220));layer.end(ev(200,220));
assert.equal(layer.strokes.length,1,'Pen must accept finger strokes');
assert.equal(layer.svg.querySelectorAll('path').length,1,'A drawn stroke is visible');
settings.tool='highlight';layer.update();
layer.start(ev(300,320,'pen'));layer.move(ev(400,420,'pen'));layer.end(ev(400,420,'pen'));
assert.equal(layer.strokes[1].opacity,.32,'Mark must remain transparent');
settings.tool='erase';layer.update();
layer.start(ev(155,170));layer.end(ev(155,170));
assert.equal(layer.strokes.length,1,'Erase removes a crossed stroke');
layer.undo();assert.equal(layer.strokes.length,2,'Undo restores erased stroke');
settings.tool='interact';layer.update();
assert.equal(layer.svg.style.pointerEvents,'none','Move mode must pass taps to the deck');
layer.destroy();smoke.window.close();
console.log('PASS: Current Science, Reading, Email formats + paged and legacy decks; finger/Pencil Pen, Mark, Erase, Undo and Move.');
