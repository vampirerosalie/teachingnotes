import {JSDOM, VirtualConsole} from 'jsdom';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {compactDeck} from '../dist/compact-deck.js';
import {readingMode} from '../dist/reading-mode.js';
for(const file of ['f4-english-reading.html','f1-science.html']) {
 const errors=[];const vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(e));
 const dom=new JSDOM(readFileSync(new URL('../dist/assets/materials/'+file,import.meta.url),'utf8'),{
  runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc,
  beforeParse(w){w.ResizeObserver=class{observe(){} disconnect(){}};w.HTMLElement.prototype.scrollTo=function(x,y){this.scrollLeft=x;this.scrollTop=y};}
 });
 const host=new JSDOM('<section><button id="full"></button><button id="prev"></button><button id="next"></button><button id="reveal"></button><span id="position"></span><button id="more"></button></section>');
 const h=host.window.document,doc=dom.window.document;
 let nativeCalls=0;doc.documentElement.requestFullscreen=()=>{nativeCalls++;return Promise.resolve()};
 const mode=readingMode(h.querySelector('section'),h.querySelector('#full'));mode.connectDeck(doc);
 const controls=Object.fromEntries(['prev','next','reveal','position','more'].map(k=>[k,h.querySelector('#'+k)]));
 const bridge=compactDeck(doc,controls);
 const initial=controls.position.textContent;assert.ok(initial.startsWith('1 /'));
 controls.next.click();assert.ok(controls.position.textContent.startsWith('2 /'));controls.prev.click();assert.equal(controls.position.textContent,initial);
 if(file.startsWith('f4')){controls.reveal.click();assert.ok(doc.querySelector('.slide.active .q.revealed'));}
 controls.more.click();assert.ok(doc.body.classList.contains('lesson-controls-open'));controls.more.click();assert.ok(!doc.body.classList.contains('lesson-controls-open'));
 const full=doc.querySelector('#full,button[onclick*="toggleFullScreen"]');full.click();assert.equal(nativeCalls,0);assert.ok(h.querySelector('section').classList.contains('reading-full'));full.click();assert.ok(!h.querySelector('section').classList.contains('reading-full'));
 assert.deepEqual(errors,[]);
 console.log(`PASS: original ${file} still navigates, exposes extra controls, and routes full screen without native fullscreen.`);
 host.window.close();dom.window.close();
}
