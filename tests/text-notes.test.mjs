import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';
import {InkLayer} from '../dist/ink.js';
import {TouchNavigator} from '../dist/gestures.js';

const dom=new JSDOM('<article id="paper">Lesson</article>',{
  pretendToBeVisual:true,url:'https://example.test/teachingnotes/'
});
const d=dom.window.document,paper=d.querySelector('#paper');
paper.getBoundingClientRect=()=>({left:0,top:0,width:1000,height:1000});
const settings={tool:'text',color:'#ba315b',size:4,finger:true};
const layer=new InkLayer(paper,()=>settings);
layer.svg.getBoundingClientRect=()=>({left:0,top:0,width:1000,height:1000});
layer.svg.setPointerCapture=()=>{};layer.svg.releasePointerCapture=()=>{};
assert.equal(layer.svg.style.pointerEvents,'none','SVG must not steal Text tool taps');
assert.equal(layer.text.root.style.pointerEvents,'auto','Text overlay receives placement taps');
assert.ok(d.getElementById('teaching-text-notes-css'),'Text styles install even inside an iframe document');

const n=layer.text.createAt(200,280,false);
assert.ok(n&&layer.text.elements.has(n.id));
assert.equal(layer.text.notes.length,1);
assert.equal(layer.actions.length,1,'Creating a text box is undoable');
const editor=layer.text.elements.get(n.id).input;
assert.equal(editor.tagName,'TEXTAREA');
editor.focus();
editor.value='Hello Form 2\n中文 Nota';
editor.dispatchEvent(new dom.window.Event('input',{bubbles:true}));
editor.blur();
assert.equal(n.text,'Hello Form 2\n中文 Nota');
assert.ok(editor.style.height,'Textarea adjusts to text content');

const ev=(id,x,y,extra={})=>({
  pointerId:id,pointerType:'touch',clientX:x,clientY:y,button:0,
  preventDefault(){},stopPropagation(){},...extra
});
const drag=layer.text.elements.get(n.id).move;
const oldX=n.x,oldY=n.y;
layer.text.beginGesture(ev(10,100,100,{currentTarget:drag}),n.id,'move');
layer.text.moveGesture(ev(10,210,230));
layer.text.endGesture(ev(10,210,230));
assert.ok(n.x>oldX && n.y>oldY,'Text moves horizontally and vertically');

const handle=layer.text.elements.get(n.id).resize;
const oldFont=n.fontSize,oldWidth=n.width;
layer.text.beginGesture(ev(11,200,200,{currentTarget:handle}),n.id,'resize');
layer.text.moveGesture(ev(11,280,290));
layer.text.endGesture(ev(11,280,290));
assert.ok(n.fontSize>oldFont,'Dragging the bottom-right handle enlarges actual text');
assert.ok(n.width>oldWidth,'Text box widens as text gets larger');
layer.undo();
assert.equal(n.fontSize>oldFont,true,'Restored note is a copy; original reference remains independent');
assert.equal(layer.text.notes[0].fontSize,oldFont,'Undo restores original text size');
layer.undo();
assert.equal(layer.text.notes[0].x,oldX,'Undo restores original position');

settings.tool='interact';layer.update();
assert.equal(layer.text.root.style.pointerEvents,'none','Move mode allows regular reading and pinch');
assert.equal(layer.svg.style.pointerEvents,'none');
assert.equal(layer.text.notes[0].text,'Hello Form 2\n中文 Nota','Text remains visible outside editor mode');

settings.tool='pen';layer.update();
assert.equal(layer.svg.style.pointerEvents,'all','Pen still works after creating text');
const penEv=(x,y)=>({...ev(17,x,y,{pointerType:'pen',buttons:1,pressure:.5})});
layer.start(penEv(20,20));layer.move(penEv(90,90));layer.end(penEv(90,90));
assert.equal(layer.strokes.length,1);
settings.tool='highlight';layer.update();
layer.start(penEv(200,220));layer.move(penEv(280,300));layer.end(penEv(280,300));
assert.equal(layer.strokes[1].opacity,.32,'Mark opacity is unchanged');
settings.tool='text';layer.update();
const beforeClear=layer.text.snapshot();
layer.clear();
assert.equal(layer.strokes.length,0);
assert.equal(layer.text.notes.length,0,'Clear removes both ink and text');
layer.undo();
assert.equal(layer.strokes.length,2,'Undo recovers pen/marker strokes after Clear');
assert.deepEqual(layer.text.snapshot(),beforeClear,'Undo recovers typed annotations after Clear');
const id=layer.text.notes[0].id;
layer.text.remove(id);
assert.equal(layer.text.notes.length,0);
layer.undo();
assert.equal(layer.text.notes.length,1,'Delete text can be undone');

// The PDF gesture navigator must not steal a Pencil/finger tap on a text box.
const surface=d.createElement('div');surface.append(paper);d.body.append(surface);
surface.getBoundingClientRect=()=>({left:0,top:0,width:1000,height:1000});
surface.setPointerCapture=()=>{};
globalThis.cancelAnimationFrame=()=>{};
globalThis.requestAnimationFrame=()=>1;
const nav=new TouchNavigator(surface,{
 getZoom:()=>1,zoomAt:()=>{},canDraw:()=>true,
 cancelInk:()=>layer.cancel(),settled:()=>{}
});
const input=layer.text.elements.get(id).input;
nav.down(ev(21,300,300,{target:input}));
assert.equal(nav.points.size,0,'PDF navigator leaves text editor taps alone');
const dragBtn=layer.text.elements.get(id).move;
nav.down(ev(22,300,300,{target:dragBtn}));
assert.equal(nav.points.size,0,'PDF navigator leaves drag and resize handles alone');
nav.destroy();
layer.destroy();
assert.equal(paper.querySelector('.typing-layer'),null);

// Instagram-style regression: no fixed empty white rectangle around short text.
const fitDom=new JSDOM('<div id="fit">Worksheet</div>',{pretendToBeVisual:true});
const fitPage=fitDom.window.document.querySelector('#fit');
fitPage.getBoundingClientRect=()=>({left:0,top:0,width:1000,height:1000});
const fitSettings={tool:'text',color:'#ba315b',size:4,finger:true};
const fitLayer=new InkLayer(fitPage,()=>fitSettings);
const fit=fitLayer.text.createAt(120,220,false),fitEntry=fitLayer.text.elements.get(fit.id);
fitEntry.input.value='祖母';
fitEntry.input.dispatchEvent(new fitDom.window.Event('input',{bubbles:true}));
assert.equal(fit.text,'祖母');
assert.ok(fit.width<110,'Two Chinese characters fit tightly, without an old 280-unit box');
assert.ok(fit.width>35,'Measured width is large enough to show two Chinese characters');
const autoWidth=fit.width;
const startSize=fit.fontSize;
const innerCss=fitDom.window.document.getElementById('teaching-text-notes-css').textContent;
assert.match(innerCss,/background:transparent!important/,'Editor and note background are fully transparent');
assert.doesNotMatch(innerCss,/background:rgba\(255,253,249,.96\)/,'Old opaque typing card must be gone');
assert.match(innerCss,/\.typing-note\.selected \.typing-note-top/,'Only selected text shows handles');
const selected=fitEntry.el;
assert.ok(selected.classList.contains('selected'),'New text is selected for dragging or resizing');
const handle2=fitEntry.resize;
fitLayer.text.beginGesture(ev(60,200,200,{currentTarget:handle2}),fit.id,'resize');
fitLayer.text.moveGesture(ev(60,290,290));
fitLayer.text.endGesture(ev(60,290,290));
assert.ok(fit.fontSize>startSize,'Corner drag enlarges the font');
assert.ok(fit.width>autoWidth,'Tight glyph width follows the bigger font');
assert.ok(fit.width/autoWidth>1.3,'Resizing produces proportional glyph width growth');
fitLayer.undo();
assert.ok(Math.abs(fitLayer.text.notes[0].width-autoWidth)<1,
  'Undo restores the tight auto-fit width');

const more=fitLayer.text.createAt(280,370,false);
const moreInput=fitLayer.text.elements.get(more.id).input;
moreInput.value='第一行\nSecond line';
moreInput.dispatchEvent(new fitDom.window.Event('input',{bubbles:true}));
assert.ok(parseFloat(moreInput.style.height)>parseFloat(fitEntry.input.style.height),
  'Multi-line height expands to content without reserving a blank box for short notes');
assert.equal(fitDom.window.document.querySelectorAll('.typing-note.selected').length,1,
  'Only one note has active Move/Delete/Resize controls');
fitLayer.destroy();fitDom.window.close();

const html=readFileSync(new URL('../dist/index.html',import.meta.url),'utf8');
const app=readFileSync(new URL('../dist/app.js',import.meta.url),'utf8');
const pdf=readFileSync(new URL('../dist/pdf-reader.js',import.meta.url),'utf8');
assert.match(html,/data-tool="text"/);
assert.match(app,/T Text · Tap to type/);
assert.match(app,/active\?\.text\?\.notes\.length/);
assert.match(pdf,/settings\(\)\.tool === 'text'/);
console.log('PASS: typed Chinese/multiline text, iPad drag and bottom-right font resize, Undo/Clear, PDF editor touch, ink coexistence and Move.');
dom.window.close();
