const NS='http://www.w3.org/2000/svg';
export class InkLayer {
 constructor(target, settings, changed){
  this.target=target;this.settings=settings;this.changed=changed;this.strokes=[];this.history=[];this.draft=null;this.pointer=null;
  this.svg=target.ownerDocument.createElementNS(NS,'svg');
  this.svg.setAttribute('viewBox','0 0 1000 1000');this.svg.setAttribute('preserveAspectRatio','none');this.svg.setAttribute('aria-label','Annotation canvas');
  Object.assign(this.svg.style,{position:'absolute',inset:'0',width:'100%',height:'100%',zIndex:'40',overflow:'hidden',userSelect:'none',webkitUserSelect:'none',touchAction:'none'});
  if(target.ownerDocument.defaultView.getComputedStyle(target).position==='static')target.style.position='relative';
  target.append(this.svg);
  this.svg.addEventListener('pointerdown',e=>this.start(e));this.svg.addEventListener('pointermove',e=>this.move(e));
  this.svg.addEventListener('pointerup',e=>this.end(e));this.svg.addEventListener('pointercancel',e=>this.end(e));this.svg.addEventListener('lostpointercapture',e=>this.end(e));this.update();
 }
 point(e){const r=this.svg.getBoundingClientRect();return [(e.clientX-r.left)/r.width*1000,(e.clientY-r.top)/r.height*1000,e.pressure||.5]}
 start(e){const s=this.settings();if(s.tool==='interact'||this.pointer!==null||(e.pointerType==='touch'&&!s.finger))return;e.preventDefault();e.stopPropagation();this.pointer=e.pointerId;this.svg.setPointerCapture(e.pointerId);this.history.push(structuredClone(this.strokes));const point=this.point(e);if(s.tool==='erase'){this.erase(point);return}this.draft={points:[point],color:s.tool==='highlight'?'#f5c84b':s.color,width:s.tool==='highlight'?s.size*6:s.size,opacity:s.tool==='highlight'?.32:1};this.draw();}
 move(e){if(e.pointerId!==this.pointer)return;e.preventDefault();e.stopPropagation();if(this.settings().tool==='erase'){this.erase(this.point(e));return}if(!this.draft)return;for(const p of (e.getCoalescedEvents?.()||[e]))this.draft.points.push(this.point(p));this.draw();}
 end(e){if(e.pointerId!==this.pointer)return;if(this.draft)this.strokes.push(this.draft);this.draft=null;this.pointer=null;this.draw();this.changed?.(this);}
 erase(p){const r=this.svg.getBoundingClientRect(),sx=r.width/1000,sy=r.height/1000;const dist=(a,b)=>{let ax=(a[0]-p[0])*sx,ay=(a[1]-p[1])*sy,bx=(b[0]-p[0])*sx,by=(b[1]-p[1])*sy,dx=bx-ax,dy=by-ay,t=Math.max(0,Math.min(1,-(ax*dx+ay*dy)/(dx*dx+dy*dy||1)));return Math.hypot(ax+t*dx,ay+t*dy)};this.strokes=this.strokes.filter(s=>!s.points.some((a,i)=>dist(a,s.points[Math.max(0,i-1)])<14+s.width/2));this.draw();}
 draw(){this.svg.replaceChildren();for(const s of [...this.strokes,...(this.draft?[this.draft]:[])]){const path=this.svg.ownerDocument.createElementNS(NS,'path');let pts=s.points.length===1?[s.points[0],[s.points[0][0]+.01,s.points[0][1]+.01]]:s.points;path.setAttribute('d',pts.map((p,i)=>`${i?'L':'M'}${p[0]} ${p[1]}`).join(' '));path.setAttribute('fill','none');path.setAttribute('stroke',s.color);path.setAttribute('stroke-width',s.width);path.setAttribute('stroke-opacity',s.opacity);path.setAttribute('stroke-linecap','round');path.setAttribute('stroke-linejoin','round');path.setAttribute('vector-effect','non-scaling-stroke');path.style.pointerEvents='none';this.svg.append(path);}this.changed?.(this);}
 update(){this.svg.style.pointerEvents=this.settings().tool==='interact'?'none':'auto';}
 cancel(){
  if(this.pointer===null)return;
  if(this.history.length)this.strokes=this.history.pop();
  const id=this.pointer;this.pointer=null;this.draft=null;
  try{this.svg.releasePointerCapture(id)}catch{}
  this.draw();
 }
 undo(){if(this.history.length){this.strokes=this.history.pop();this.draft=null;this.draw();}}
 clear(){if(this.strokes.length){this.history.push(structuredClone(this.strokes));this.strokes=[];this.draw();}}
 destroy(){this.svg.remove();}
}
