import {JSDOM, VirtualConsole} from 'jsdom';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {selectionGuard} from '../dist/selection-guard.js';
import {readingMode} from '../dist/reading-mode.js';
for(const file of ['f4-english-reading.html','f1-science.html']) {
 const errors=[];const vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(e));
 const dom=new JSDOM(readFileSync(new URL('../dist/assets/materials/'+file,import.meta.url),'utf8'),{
  runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc,
  beforeParse(w){w.ResizeObserver=class{observe(){} disconnect(){}};w.HTMLElement.prototype.scrollTo=function(x,y){this.scrollLeft=x;this.scrollTop=y};}
 });
 const host=new JSDOM('<section><button id="full"></button></section>');
 const h=host.window.document,doc=dom.window.document,science=file.startsWith('f1');
 const bar=doc.querySelector(science?'body>.toolbar':'.controls');
 const originalHTML=bar.innerHTML, originalCSS=doc.head.querySelector('style').textContent;
 const full=doc.querySelector('#full,button[onclick*="toggleFullScreen"]'),fullLabel=full.textContent;
 let native=0;doc.documentElement.requestFullscreen=()=>{native++;return Promise.resolve()};
 const mode=readingMode(h.querySelector('section'),h.querySelector('#full'));mode.connectDeck(doc);
 const guard=selectionGuard(doc.body);guard.set(true);
 assert.notEqual(dom.window.getComputedStyle(bar).display,'none');
 assert.notEqual(dom.window.getComputedStyle(full).display,'none');
 assert.equal(full.textContent,fullLabel,'Original fullscreen label is preserved when not expanded');
 assert.equal(doc.head.querySelector('style').textContent,originalCSS,'Deck styling is not rewritten');
 const position=doc.querySelector(science?'#position':'#progress');const initial=position.textContent;
 const next=doc.querySelector(science?'#next':'button[onclick="nextSlide()"]');
 const previous=doc.querySelector(science?'#prev':'button[onclick="prevSlide()"]');
 next.click();assert.ok(position.textContent.startsWith('2 /'));previous.click();assert.equal(position.textContent,initial);
 if(!science){doc.querySelector('button[onclick="revealAnswer()"]').click();assert.ok(doc.querySelector('.slide.active .q.revealed'));}
 full.click();assert.equal(native,0);assert.ok(h.querySelector('section').classList.contains('reading-full'));full.click();assert.equal(full.textContent,fullLabel);
 guard.set(false);assert.ok(!doc.body.classList.contains('no-browser-selection'));
 assert.deepEqual(errors,[]);
 guard.destroy();console.log(`PASS: ${file} original bar/buttons remain visible and work, styling intact, fullscreen does not use Safari native mode.`);
 host.window.close();dom.window.close();
}
