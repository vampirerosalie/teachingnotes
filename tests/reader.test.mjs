import {JSDOM} from 'jsdom';
import assert from 'node:assert/strict';
import {PDFReader} from '../dist/pdf-reader.js';
import {InkLayer} from '../dist/ink.js';
const dom = new JSDOM('<div id="scroll"></div>');
globalThis.document = dom.window.document;
globalThis.devicePixelRatio = 2;
globalThis.ResizeObserver = class {observe() {} disconnect() {}};
let nextFrame = 1;
const frames = new Map();
globalThis.requestAnimationFrame = fn => {const n=nextFrame++; frames.set(n,fn); return n;};
globalThis.cancelAnimationFrame = n => frames.delete(n);
const flush = async () => {
  for(let i=0;i<30;i++) { const pending=[...frames.values()]; frames.clear(); pending.forEach(fn=>fn(performance.now())); await Promise.resolve(); }
};
dom.window.HTMLCanvasElement.prototype.getContext = () => ({});
const surface = document.querySelector('#scroll');
let width=1000;
Object.defineProperties(surface,{clientWidth:{get:()=>width},clientHeight:{get:()=>700}});
surface.setPointerCapture = () => {};
surface.getBoundingClientRect = () => ({left:0,top:0,width,height:700});
const settings={tool:'pen',color:'#ff0000',size:4,finger:false};
let page=0, zoom=0, failOnce=true;
const fakeDoc={numPages:37, async getPage(number) {return {
 getViewport:({scale})=>({width:600*scale,height:840*scale}),
 render() {if(number===6&&failOnce){failOnce=false;return {promise:Promise.reject(Object.assign(new Error('cancelled'),{name:'RenderingCancelledException'})),cancel(){}}}return {promise:Promise.resolve(),cancel(){}}}
}}};
const reader=new PDFReader(surface,fakeDoc,{settings:()=>settings,layerFor:(target)=>new InkLayer(target,()=>settings),onPage:n=>page=n,onZoom:z=>zoom=z});
await reader.init();await flush();
assert.equal(surface.querySelectorAll('.pdf-page').length,37);
assert.equal(page,1);
assert.ok(surface.querySelectorAll('canvas').length>=1);
const first=reader.pages[0], second=reader.pages[1];
assert.equal(second.top,first.height+20,'Pages are stacked with a gap');
first.layer.strokes=[{points:[[20,20],[80,80]],color:'#ff0000',width:4,opacity:1}];first.layer.draw();
reader.goTo(20);await flush();assert.equal(page,20);assert.equal(first.canvas,null,'Far-away page raster is released');assert.equal(first.layer.strokes.length,1,'Offscreen notes are retained');
assert.ok(surface.querySelectorAll('canvas').length<=5,'Raster memory stays bounded');
const from={x:500,y:350};surface.scrollLeft=50;
const beforeX=(surface.scrollLeft+from.x-reader.originX)/reader.zoom;
const beforeY=(surface.scrollTop+from.y-16)/reader.zoom;
reader.zoomAt(2,from);await flush();
assert.equal(zoom,2);
assert.ok(Math.abs((surface.scrollLeft+from.x-reader.originX)/reader.zoom-beforeX)<.001,'Pinch keeps horizontal anchor');
assert.ok(Math.abs((surface.scrollTop+from.y-16)/reader.zoom-beforeY)<.001,'Pinch keeps vertical anchor');
reader.zoomAt(1,from);await flush();assert.equal(reader.zoom,1);
reader.zoomAt(100);assert.equal(reader.zoom,4);reader.zoomAt(.01);assert.equal(reader.zoom,.5);reader.zoomAt(1);
reader.goTo(1);await flush();assert.equal(first.layer.strokes.length,1);assert.ok(first.element.querySelector('svg path'));
width=800;reader.resize();await flush();assert.equal(reader.baseWidth,768);assert.equal(first.layer.strokes.length,1);
reader.goTo(6);await flush();assert.ok(reader.pages[5].canvas,'Cancelled render is retried');
reader.destroy();await flush();assert.equal(surface.children.length,0);assert.equal(reader.alive,false);
console.log('PASS: 37 continuous page shells, scrolling/current page, two-direction zoom anchors and limits, resize, bounded raster memory, cancelled render recovery, note retention and teardown.');
dom.window.close();
