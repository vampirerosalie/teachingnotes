// Draggable, editable, resizable text boxes attached to each existing lesson page.
// Coordinates and font sizes are stored in a 0..1000 page space so PDF/HTML zoom
// transforms move and scale annotations with the underlying material.
const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
export class TextNotes {
  constructor(target, settings, changed, record){
    this.target=target;this.settings=settings;this.changed=changed;this.record=record;
    this.doc=target.ownerDocument;this.win=this.doc.defaultView;
    // HTML lessons run in an iframe: install the annotation styles there too.
    if(!this.doc.getElementById('teaching-text-notes-css')){
      const style=this.doc.createElement('style');
      style.id='teaching-text-notes-css';
      style.textContent="\n/* Instagram-style annotations: no white card behind typed words. */\n.typing-layer,.typing-layer *{box-sizing:border-box}\n.typing-note{position:absolute;z-index:1;color:var(--typing-color,#25334a);\n font-family:Arial,\"Noto Sans SC\",\"Microsoft YaHei\",sans-serif;line-height:1.24;\n border:0!important;outline:0;background:transparent!important;box-shadow:none!important;\n min-width:0;min-height:0;overflow:visible;pointer-events:none}\n.typing-note-editor{display:block;box-sizing:border-box;width:100%;min-width:0;min-height:1.24em;\n margin:0;padding:0 2px;border:0!important;outline:0;overflow:hidden;resize:none;\n background:transparent!important;box-shadow:none!important;color:inherit;\n font:inherit;line-height:1.24;white-space:pre-wrap;overflow-wrap:anywhere;\n -webkit-user-select:text!important;user-select:text!important;\n -webkit-touch-callout:default!important;caret-color:var(--typing-color,#25334a)}\n.typing-note-editor::placeholder{color:rgba(92,68,115,.58);font-size:.7em}\n.typing-layer.is-typing .typing-note{pointer-events:auto;background:transparent!important;\n border:0!important;box-shadow:none!important}\n.typing-layer:not(.is-typing) .typing-note-editor{pointer-events:none}\n.typing-layer:not(.is-typing) .typing-note-editor::placeholder{color:transparent}\n.typing-note-top{display:none;position:absolute;left:0;bottom:calc(100% + 4px);\n width:max-content;min-width:0;height:29px;padding:0;\n align-items:center;gap:5px;background:transparent!important;border:0;box-shadow:none}\n.typing-layer.is-typing .typing-note.selected .typing-note-top{display:flex}\n.typing-note-drag,.typing-note-delete,.typing-note-resize{\n display:grid;place-items:center;background:rgba(241,237,250,.92);color:#49355f;\n font:700 13px/1.1 Arial,sans-serif;border:1px solid rgba(188,175,208,.85);\n border-radius:6px;min-width:28px;min-height:27px;padding:2px 5px;\n touch-action:none;-webkit-user-select:none!important;user-select:none!important;\n -webkit-touch-callout:none;cursor:grab}\n.typing-note-drag{padding:2px 8px}\n.typing-note-delete{font-size:20px;background:rgba(255,241,241,.92);color:#922d4c}\n.typing-note-resize{display:none;position:absolute;right:-13px;bottom:-14px;\n width:32px;height:32px;font-size:18px;cursor:nwse-resize;\n background:rgba(233,220,250,.92);box-shadow:0 1px 5px #0002}\n.typing-layer.is-typing .typing-note.selected .typing-note-resize{display:grid}\n.typing-layer.is-typing .typing-note:focus-within .typing-note-editor{\n outline:1px dashed rgba(114,76,145,.43);outline-offset:1px}\n";
      this.doc.head.append(style);
    }
    this.notes=[];this.nextId=1;this.pending=null;this.editing=null;this.elements=new Map();
    this.root=this.doc.createElement('div');
    this.root.className='typing-layer';
    this.root.setAttribute('aria-label','Editable text annotations');
    Object.assign(this.root.style,{
      position:'absolute',inset:'0',width:'100%',height:'100%',
      zIndex:'42',pointerEvents:'none',touchAction:'pan-x pan-y pinch-zoom'
    });
    if(this.win.getComputedStyle(target).position==='static')target.style.position='relative';
    target.append(this.root);
    this.sizer=this.doc.createElement('span');
    Object.assign(this.sizer.style,{position:'absolute',visibility:'hidden',pointerEvents:'none',
      whiteSpace:'pre',left:'-99999px',top:'0',display:'inline-block'});
    this.root.append(this.sizer);
    this.listeners=[];
    this.on=(node,name,fn,options=false)=>{
      node.addEventListener(name,fn,options);
      this.listeners.push([node,name,fn,options]);
    };
    this.on(this.root,'click',e=>{
      if(this.settings().tool!=='text'||e.target!==this.root)return;
      this.createAt(e.clientX,e.clientY,true);
    });
    this.on(this.doc,'pointermove',e=>this.moveGesture(e),{capture:true,passive:false});
    this.on(this.doc,'pointerup',e=>this.endGesture(e),true);
    this.on(this.doc,'pointercancel',e=>this.cancelGesture(e),true);
    this.on(this.win,'blur',()=>this.endGesture(null));
    // PDF pages change their CSS widths on rotation. Recalculate the actual
    // font pixel size from our normalized page-space size in that case.
    const resize=()=>{for(const n of this.notes)this.apply(n)};
    if(typeof this.win.ResizeObserver==='function'){
      this.resizeObserver=new this.win.ResizeObserver(resize);
      this.resizeObserver.observe(this.target);
    }else{
      this.on(this.win,'resize',resize);
    }
    this.update();
  }
  snapshot(){
    return this.notes.map(n=>({...n}));
  }
  save(before){this.record(before);this.changed();}
  defaultPoint(clientX,clientY){
    const r=this.target.getBoundingClientRect();
    return {
      x:clamp((clientX-r.left)/Math.max(1,r.width)*1000,0,920),
      y:clamp((clientY-r.top)/Math.max(1,r.height)*1000,0,950)
    };
  }
  createAt(clientX,clientY,focus=true){
    if(this.settings().tool!=='text')return null;
    const before=this.snapshot();
    const p=this.defaultPoint(clientX,clientY);
    const note={id:this.nextId++,x:p.x,y:p.y,width:0,
      fontSize:27,text:'',color:this.settings().color||'#273044'};
    this.notes.push(note);
    this.mount(note);
    this.select(note.id);
    this.save(before);
    const entry=this.elements.get(note.id);
    if(focus&&entry?.input){
      entry.input.focus({preventScroll:true});
    }
    return note;
  }
  mount(note){
    const el=this.doc.createElement('div');
    el.className='typing-note';
    el.dataset.noteId=String(note.id);
    const top=this.doc.createElement('div');
    top.className='typing-note-top';
    const move=this.doc.createElement('button');
    move.type='button';move.className='typing-note-drag';
    move.setAttribute('aria-label','Drag to move text');
    move.textContent='⠿ Move';
    const remove=this.doc.createElement('button');
    remove.type='button';remove.className='typing-note-delete';
    remove.setAttribute('aria-label','Delete this text');
    remove.textContent='×';
    top.append(move,remove);
    const input=this.doc.createElement('textarea');
    input.className='typing-note-editor';input.rows=1;input.spellcheck=true;
    input.setAttribute('aria-label','Type your lesson annotation');
    input.placeholder='Tap here to type…';
    input.value=note.text;
    const resize=this.doc.createElement('button');
    resize.type='button';resize.className='typing-note-resize';
    resize.setAttribute('aria-label','Drag bottom-right to resize text');
    resize.textContent='◢';
    el.append(top,input,resize);
    this.root.append(el);
    this.elements.set(note.id,{el,input,move,resize});
    this.apply(note);
    this.on(move,'pointerdown',e=>this.beginGesture(e,note.id,'move'));
    this.on(resize,'pointerdown',e=>this.beginGesture(e,note.id,'resize'));
    this.on(remove,'click',e=>{
      e.preventDefault();e.stopPropagation();
      this.remove(note.id);
    });
    this.on(input,'focus',()=>{
      this.select(note.id);
      this.editing={id:note.id,before:this.snapshot(),original:note.text};
      el.classList.add('editing');
    });
    this.on(input,'input',()=>{
      const n=this.notes.find(n=>n.id===note.id);if(!n)return;
      n.text=input.value;this.apply(n);
    });
    this.on(input,'blur',()=>{
      el.classList.remove('editing');
      const edit=this.editing;
      if(edit?.id===note.id){
        this.editing=null;
        const n=this.notes.find(n=>n.id===note.id);
        if(n && n.text!==edit.original)this.save(edit.before);
      }
    });
    this.apply(note);
  }
  // Only one note shows its small Move / Delete / Resize handles at a time.
  // The rest remain plain, transparent text.
  select(id){
    for(const [key,entry] of this.elements)
      entry.el.classList.toggle('selected',key===id);
  }
  // Measure the actual rendered text (including CJK glyph widths) rather
  // than giving every note a fixed-width rectangle. offsetWidth is important:
  // unlike getBoundingClientRect it isn't distorted by PDF/HTML zoom transforms.
  lineWidth(line,fontPx){
    const value=line||' ';
    this.sizer.textContent=value;
    this.sizer.style.font=fontPx+'px Arial, "Noto Sans SC","Microsoft YaHei",sans-serif';
    const measured=this.sizer.offsetWidth||0;
    if(measured>0)return measured;
    // jsdom/headless fallback; browsers use the precise DOM measurement.
    const em=Array.from(value).reduce((sum,ch)=>{
      if(/[\u2e80-\u9fff\uac00-\ud7af]/u.test(ch))return sum+1;
      if(/[ilI.,!:'\x60| ]/.test(ch))return sum+.30;
      if(/[MW@#%&]/.test(ch))return sum+.91;
      return sum+.59;
    },0);
    return em*fontPx;
  }
  apply(note){
    const entry=this.elements.get(note.id);
    if(!entry)return;
    const targetWidth=Math.max(1,this.target.clientWidth||this.target.getBoundingClientRect().width||1000);
    const fontPx=targetWidth*note.fontSize/1000;
    const lines=String(note.text||'').replace(/\r/g,'').split('\n');
    const naturalPx=note.text
      ? Math.max(...lines.map(line=>this.lineWidth(line,fontPx)))+6
      : Math.max(68,fontPx*2.7);
    const available= Math.max(8,1000-note.x-8);
    const minWidth=Math.min(available,(note.text?Math.max(20,fontPx*.7):68)/targetWidth*1000);
    note.width=Math.min(available,Math.max(minWidth,naturalPx/targetWidth*1000));
    entry.el.style.left=(note.x/10)+'%';
    entry.el.style.top=(note.y/10)+'%';
    entry.el.style.width=(note.width/10)+'%';
    entry.el.style.fontSize=fontPx+'px';
    entry.el.style.setProperty('--typing-color',note.color);
    this.adjustHeight(entry.input,fontPx,lines,note.width*targetWidth/1000);
  }
  adjustHeight(input,fontPx,lines,availablePx){
    input.style.height='auto';
    // Match the number of typed lines; very long lines wrap only if they hit
    // the edge of the lesson page. Never reserve a fixed two-row white box.
    const textLines=lines.reduce((count,line)=>{
      const pixelWidth=this.lineWidth(line,fontPx);
      return count+Math.max(1,Math.ceil(pixelWidth/Math.max(1,availablePx-5)));
    },0);
    const minimum=fontPx*1.24*Math.max(1,textLines)+3;
    input.style.height=Math.max(minimum,input.scrollHeight||0)+'px';
  }
  remove(id){
    const before=this.snapshot(),index=this.notes.findIndex(n=>n.id===id);
    if(index<0)return;
    this.notes.splice(index,1);
    this.elements.get(id)?.el.remove();
    this.elements.delete(id);
    this.save(before);
  }
  beginGesture(e,id,mode){
    if(this.settings().tool!=='text')return;
    if(e.pointerType==='mouse' && e.button!==0)return;
    e.preventDefault();e.stopPropagation();
    if(this.pending)this.endGesture(null);
    this.editing=null;
    const n=this.notes.find(n=>n.id===id);
    if(!n)return;
    this.select(id);
    this.pending={id,pointerId:e.pointerId,mode,
      fromX:e.clientX,fromY:e.clientY,
      start:{...n},before:this.snapshot(),changed:false};
    try{e.currentTarget?.setPointerCapture?.(e.pointerId)}catch{}
  }
  moveGesture(e){
    const p=this.pending;
    if(!p || e.pointerId!==p.pointerId)return;
    e.preventDefault();e.stopPropagation();
    const n=this.notes.find(n=>n.id===p.id);if(!n)return;
    const rect=this.target.getBoundingClientRect();
    const dx=(e.clientX-p.fromX)/Math.max(1,rect.width)*1000;
    const dy=(e.clientY-p.fromY)/Math.max(1,rect.height)*1000;
    if(p.mode==='move'){
      n.x=clamp(p.start.x+dx,0,1000-n.width);
      n.y=clamp(p.start.y+dy,0,960);
    }else{
      // Diagonal drag resizes the text itself, not merely an empty rectangle.
      // Instagram-style: the gesture changes font size ONLY.
      // apply() measures the new glyph bounds and fits the box tightly.
      const factor=clamp(1+(dx+dy)*.0035,.4,3.8);
      n.fontSize=clamp(p.start.fontSize*factor,11,96);
    }
    p.changed=p.changed || Math.abs(n.x-p.start.x)>1 ||
      Math.abs(n.y-p.start.y)>1 || Math.abs(n.fontSize-p.start.fontSize)>.3 ||
      Math.abs(n.width-p.start.width)>1;
    this.apply(n);
  }
  endGesture(e){
    const p=this.pending;
    if(!p || (e && e.pointerId!==p.pointerId))return;
    if(e){e.preventDefault();e.stopPropagation()}
    this.pending=null;
    if(p.changed)this.save(p.before);
  }
  cancelGesture(e){
    if(!this.pending || (e && e.pointerId!==this.pending.pointerId))return;
    const p=this.pending;this.pending=null;
    if(p.changed)this.restore(p.before);
  }
  restore(snapshot){
    this.editing=null;this.pending=null;
    for(const entry of this.elements.values())entry.el.remove();
    this.elements.clear();
    this.notes=snapshot.map(n=>({...n}));
    this.nextId=Math.max(0,...this.notes.map(n=>n.id))+1;
    for(const n of this.notes)this.mount(n);
    this.select(this.notes.at(-1)?.id);
    this.update();
    this.changed();
  }
  clearSilently(){
    this.editing=null;this.pending=null;
    for(const entry of this.elements.values())entry.el.remove();
    this.elements.clear();this.notes=[];
    this.changed();
  }
  update(){
    const isText=this.settings().tool==='text';
    this.root.style.pointerEvents=isText?'auto':'none';
    this.root.classList.toggle('is-typing',isText);
  }
  destroy(){
    this.resizeObserver?.disconnect();
    this.pending=null;
    for(const [node,name,fn,opts] of this.listeners)node.removeEventListener(name,fn,opts);
    this.listeners=[];this.elements.clear();this.root.remove();
  }
}
