// Draggable, editable, resizable text boxes attached to each existing lesson page.
// Coordinates and font sizes are stored in a 0..1000 page space so PDF/HTML zoom
// transforms move and scale annotations with the underlying material.
const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
export class TextNotes {
  constructor(target, settings, changed, record){
    this.target=target;this.settings=settings;this.changed=changed;this.record=record;
    this.doc=target.ownerDocument;this.win=this.doc.defaultView;
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
    this.update();
  }
  snapshot(){
    return this.notes.map(n=>({...n}));
  }
  save(before){this.record(before);this.changed();}
  defaultPoint(clientX,clientY){
    const r=this.target.getBoundingClientRect();
    return {
      x:clamp((clientX-r.left)/Math.max(1,r.width)*1000,0,985),
      y:clamp((clientY-r.top)/Math.max(1,r.height)*1000,0,950)
    };
  }
  createAt(clientX,clientY,focus=true){
    if(this.settings().tool!=='text')return null;
    const before=this.snapshot();
    const p=this.defaultPoint(clientX,clientY);
    const width=clamp(280,140,1000-p.x);
    const note={id:this.nextId++,x:clamp(p.x,0,1000-width),y:p.y,width,
      fontSize:27,text:'',color:this.settings().color||'#273044'};
    this.notes.push(note);
    this.mount(note);
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
    input.className='typing-note-editor';input.rows=2;input.spellcheck=true;
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
      this.editing={id:note.id,before:this.snapshot(),original:note.text};
      el.classList.add('editing');
    });
    this.on(input,'input',()=>{
      const n=this.notes.find(n=>n.id===note.id);if(!n)return;
      n.text=input.value;this.adjustHeight(input);
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
    this.adjustHeight(input);
  }
  apply(note){
    const entry=this.elements.get(note.id);
    if(!entry)return;
    const width=Math.max(1,this.target.clientWidth||this.target.getBoundingClientRect().width||1000);
    entry.el.style.left=(note.x/10)+'%';
    entry.el.style.top=(note.y/10)+'%';
    entry.el.style.width=(note.width/10)+'%';
    entry.el.style.fontSize=(width*note.fontSize/1000)+'px';
    entry.el.style.setProperty('--typing-color',note.color);
    this.adjustHeight(entry.input);
  }
  adjustHeight(input){
    input.style.height='auto';
    input.style.height=Math.max(38,input.scrollHeight||0)+'px';
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
      const factor=clamp(1+(dx+dy)*.003,.45,3.6);
      n.fontSize=clamp(p.start.fontSize*factor,11,96);
      n.width=clamp(p.start.width*factor,100,1000-n.x);
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
    this.pending=null;
    for(const [node,name,fn,opts] of this.listeners)node.removeEventListener(name,fn,opts);
    this.listeners=[];this.elements.clear();this.root.remove();
  }
}
