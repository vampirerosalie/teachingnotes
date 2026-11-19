import {TextNotes} from './text-notes.js?v=1.0';
const NS = 'http://www.w3.org/2000/svg';
export class InkLayer {
  constructor(target, settings, changed) {
    this.target = target; this.settings = settings; this.changed = changed;
    this.strokes = []; this.history = []; this.actions=[]; this.draft = null; this.pointer = null;
    this.pointerType = null; this.path = null; this.frame = null;
    this.doc = target.ownerDocument; this.win = this.doc.defaultView;
    this.svg = this.doc.createElementNS(NS, 'svg');
    this.svg.setAttribute('viewBox', '0 0 1000 1000');
    this.svg.setAttribute('preserveAspectRatio', 'none');
    this.svg.setAttribute('aria-label', 'Annotation canvas');
    this.svg.classList.add('ink-overlay');
    Object.assign(this.svg.style, {position:'absolute', inset:'0', width:'100%', height:'100%', zIndex:'40', overflow:'hidden', userSelect:'none', webkitUserSelect:'none', webkitTouchCallout:'none', touchAction:'none'});
    // A permanent transparent hit area also receives Pencil input on empty SVG regions.
    this.hit = this.doc.createElementNS(NS, 'rect');
    this.hit.setAttribute('width', '1000'); this.hit.setAttribute('height', '1000');
    this.hit.setAttribute('fill', 'transparent'); this.hit.style.pointerEvents = 'inherit';
    this.svg.append(this.hit);
    if (this.win.getComputedStyle(target).position === 'static') target.style.position = 'relative';
    target.append(this.svg);
    this.text=new TextNotes(target,()=>this.settings(),()=>this.changed?.(this),
      before=>{this.actions.push({kind:'text',before});this.changed?.(this)});
    this.bindings = [];
    const on = (node, name, handler, options = false) => {
      node.addEventListener(name, handler, options); this.bindings.push([node, name, handler, options]);
    };
    on(this.svg, 'pointerdown', e => this.start(e), {passive:false});
    on(this.svg, 'pointermove', e => this.move(e), {passive:false});
    // Document-level endings recover if the Pencil lifts outside the page/capture is interrupted.
    on(this.doc, 'pointerup', e => this.end(e), {capture:true, passive:false});
    on(this.doc, 'pointercancel', e => this.end(e), true);
    on(this.svg, 'lostpointercapture', e => {
      if (!this.svg.hasPointerCapture?.(e.pointerId)) this.end(e);
    });
    for (const name of ['selectstart', 'contextmenu', 'dragstart']) on(this.svg, name, e => e.preventDefault());
    for (const name of ['touchstart','touchmove']) on(this.svg,name,e=>{if(this.settings().tool!=='interact')e.preventDefault();},{passive:false});
    on(this.win, 'blur', () => this.finish());
    on(this.win, 'resize', () => this.finish());
    on(this.doc, 'visibilitychange', () => { if (this.doc.hidden) this.finish(); });
    on(this.doc, 'scroll', () => this.finish(), true);
    this.update();
  }
  point(e) {
    const r = this.rect || this.svg.getBoundingClientRect();
    return [(e.clientX-r.left)/r.width*1000, (e.clientY-r.top)/r.height*1000, e.pressure || .5];
  }
  start(e) {
    const s = this.settings();
    if (s.tool === 'interact') return;
    if (e.pointerType === 'touch' && (!s.finger || this.pointerType === 'pen')) { e.preventDefault(); e.stopPropagation(); return; }
    if (e.pointerType === 'mouse' && e.button !== undefined && e.button !== 0) return;
    e.preventDefault(); e.stopPropagation();
    // A fresh down is a new stroke even if Safari missed an earlier up event.
    if (this.pointer !== null) this.finish();
    this.win.getSelection?.()?.removeAllRanges();
    this.rect = this.svg.getBoundingClientRect();
    if (!this.rect.width || !this.rect.height) return;
    this.pointer = e.pointerId; this.pointerType = e.pointerType; this.strokeTool = s.tool;
    try { this.svg.setPointerCapture(e.pointerId); } catch { /* document endings remain available */ }
    // Committed strokes are immutable; snapshots can share them instead of copying every point.
    this.history.push(this.strokes.slice());
    this.actions.push({kind:'ink'});
    const point = this.point(e);
    if (s.tool === 'erase') { this.erase(point); return; }
    this.draft = {points:[point], color:s.tool === 'highlight' ? '#f5c84b' : s.color, width:s.tool === 'highlight' ? s.size*6 : s.size, opacity:s.tool === 'highlight' ? .32 : 1};
    this.path = this.makePath(this.draft); this.svg.append(this.path);
    this.pathData = `M${point[0]} ${point[1]}`;
    this.path.setAttribute('d', `${this.pathData}l.01 .01`);
    this.changed?.(this);
  }
  move(e) {
    if (e.pointerId !== this.pointer) return;
    // Hover after Pencil lift must never join a later contact with a long diagonal line.
    if ((this.pointerType === 'pen' || this.pointerType === 'mouse') && e.buttons === 0) { this.finish(); return; }
    e.preventDefault(); e.stopPropagation();
    if (this.strokeTool === 'erase') { this.erase(this.point(e)); return; }
    if (!this.draft) return;
    const coalesced = e.getCoalescedEvents?.();
    // WebKit can expose this API but return an empty array for a normal move.
    const samples = coalesced?.length ? coalesced : [e];
    for (const sample of samples) {
      if ((this.pointerType === 'pen' || this.pointerType === 'mouse') && sample.buttons === 0) continue;
      const p = this.point(sample);
      this.draft.points.push(p); this.pathData += `L${p[0]} ${p[1]}`;
    }
    if (this.frame === null) {
      if (this.win.requestAnimationFrame) this.frame = this.win.requestAnimationFrame(() => {this.frame=null; this.paintDraft();});
      else this.paintDraft();
    }
  }
  paintDraft() { if (this.path && this.draft) this.path.setAttribute('d', this.pathData + (this.draft.points.length === 1 ? 'l.01 .01' : '')); }
  finish() {
    if (this.pointer === null) return;
    if (this.frame !== null) this.win.cancelAnimationFrame?.(this.frame);
    this.frame = null; this.paintDraft();
    if (this.draft) this.strokes.push(this.draft);
    const id=this.pointer;
    this.pointer=null; this.pointerType=null; this.draft=null; this.path=null; this.rect=null;
    try { this.svg.releasePointerCapture(id); } catch {}
    this.changed?.(this);
  }
  end(e) {
    if (e.pointerId !== this.pointer) return;
    if (e.cancelable !== false) e.preventDefault();
    this.finish();
  }
  erase(p) {
    const r=this.rect || this.svg.getBoundingClientRect(), sx=r.width/1000, sy=r.height/1000;
    const dist=(a,b)=>{
      const ax=(a[0]-p[0])*sx, ay=(a[1]-p[1])*sy, bx=(b[0]-p[0])*sx, by=(b[1]-p[1])*sy, dx=bx-ax, dy=by-ay;
      const t=Math.max(0,Math.min(1,-(ax*dx+ay*dy)/(dx*dx+dy*dy || 1)));
      return Math.hypot(ax+t*dx,ay+t*dy);
    };
    const next=this.strokes.filter(s=>!s.points.some((a,i)=>dist(a,s.points[Math.max(0,i-1)]) < 14+s.width/2));
    if (next.length !== this.strokes.length) { this.strokes=next; this.draw(); }
  }
  makePath(s) {
    const path=this.doc.createElementNS(NS,'path');
    for (const [key,value] of Object.entries({fill:'none',stroke:s.color,'stroke-width':s.width,'stroke-opacity':s.opacity,'stroke-linecap':'round','stroke-linejoin':'round','vector-effect':'non-scaling-stroke'})) path.setAttribute(key,value);
    path.style.pointerEvents='none'; return path;
  }
  draw() {
    // Full redraws are only for restore, erase, undo and clear, never each pen movement.
    this.svg.querySelectorAll('path').forEach(path=>path.remove());
    for (const s of this.strokes) {
      const path=this.makePath(s);
      path.setAttribute('d',s.points.map((p,i)=>`${i?'L':'M'}${p[0]} ${p[1]}`).join(' ') + (s.points.length===1?'l.01 .01':''));
      this.svg.append(path);
    }
    this.changed?.(this);
  }
  update() {
    if (this.pointer !== null && this.strokeTool !== this.settings().tool) this.finish();
    this.svg.style.pointerEvents=['interact','text'].includes(this.settings().tool)?'none':'all';
    this.text.update();
  }
  cancel() {
    if (this.pointer === null) {this.text.cancelGesture();return;}
    if (this.frame !== null) this.win.cancelAnimationFrame?.(this.frame);
    this.frame=null;
    if (this.history.length) this.strokes=this.history.pop();
    if(this.actions.at(-1)?.kind==='ink')this.actions.pop();
    const id=this.pointer; this.pointer=null; this.pointerType=null; this.draft=null; this.path=null; this.rect=null;
    try {this.svg.releasePointerCapture(id);} catch {}
    this.draw();
  }
  undo() {
    this.finish();
    const action=this.actions.pop();
    if(action?.kind==='text'){
      this.text.restore(action.before);
    }else if(action?.kind==='all'){
      if(action.hadInk&&this.history.length)this.history.pop();
      this.strokes=action.strokes.slice();
      this.text.restore(action.notes);
      this.draw();
    }else if(action?.kind==='ink'||(!action&&this.history.length)){
      if(this.history.length){this.strokes=this.history.pop();this.draw();}
    }
    this.changed?.(this);
  }
  clear() {
    this.finish();
    if(!this.strokes.length && !this.text.notes.length)return;
    const beforeInk=this.strokes.slice(),beforeNotes=this.text.snapshot();
    const hadInk=beforeInk.length>0;
    if(hadInk)this.history.push(beforeInk);
    this.actions.push({kind:'all',strokes:beforeInk,notes:beforeNotes,hadInk});
    this.strokes=[];
    this.text.clearSilently();
    this.draw();
  }
  destroy() {
    this.finish();
    for (const [node,name,handler,options] of this.bindings) node.removeEventListener(name,handler,options);
    this.bindings=[]; this.text.destroy();this.svg.remove();
  }
}
