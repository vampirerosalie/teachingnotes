import {materials} from './materials.js?v=3.18';
import {InkLayer} from './ink.js?v=3.3';
import {annotationTargets, nearestVisibleTarget} from './deck-annotations.js?v=1.0';
import {PDFReader} from './pdf-reader.js?v=3.2';
import {readingMode} from './reading-mode.js?v=3.1';
import {maskPassword} from './password.js?v=3.1';
import {selectionGuard} from './selection-guard.js?v=3.1';
const $=s=>document.querySelector(s);
const levels=['Year 4','Year 5','Year 6','Form 1','Form 2','Form 3','Form 4','Form 5'];
const months=['January','February','March','April','May','June','July','August','September','October','November','December'];
const subjects={BM:'Bahasa Melayu',BI:'Bahasa Inggeris',Science:'Science'};
let selection={level:null,subject:null,month:null};
let current=null,doc=null,loadingTask=null,reader=null,epoch=0,deckTimer=null,deckSelection=null;
const fullMode=readingMode($('#viewer'),$('#fullViewer'));
const viewerSelection=selectionGuard($('#viewer'));viewerSelection.set(true);
const syncPassword=maskPassword($('#password'),$('#passwordDots'));
const layers=new Map();let active=null;
const settings={tool:'interact',color:'#ba315b',size:4,finger:true};
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function matching(filter){return materials.filter(m=>Object.entries(filter).every(([k,v])=>v===null||m[k]===v))}
function countLabel(n){return n?`${n} material${n===1?'':'s'}`:'Ready for lessons'}
function renderLibrary(){const s=selection;$('#breadcrumbs').replaceChildren();const crumb=(label,action)=>{const b=document.createElement('button');b.textContent=label;b.onclick=action;$('#breadcrumbs').append(b);};crumb('All levels',()=>{selection={level:null,subject:null,month:null};renderLibrary()});if(s.level)crumb(s.level,()=>{selection={level:s.level,subject:null,month:null};renderLibrary()});if(s.subject)crumb(s.subject,()=>{selection.month=null;renderLibrary()});if(s.month)crumb(months[s.month-1],()=>{});
 const box=$('#choices');box.className='';
 if(!s.level){$('#sectionTitle').textContent='Choose a level';$('#sectionMeta').textContent='08 LEVELS';box.className='level-grid';box.innerHTML=levels.map(level=>{let n=matching({level}).length;return `<button class="level-card ${n?'ready':''}" data-level="${level}"><span class="tag">${level.startsWith('Year')?'PRIMARY':'SECONDARY'}</span><strong>${level}</strong><span class="card-bottom">${countLabel(n)} <span class="arrow">↗</span></span></button>`}).join('');box.querySelectorAll('button').forEach(b=>b.onclick=()=>{selection.level=b.dataset.level;renderLibrary()});}
 else if(!s.subject){$('#sectionTitle').textContent=`${s.level} · Choose a subject`;$('#sectionMeta').textContent=s.level.startsWith('Year')?'PRIMARY':'03 SUBJECTS';if(s.level.startsWith('Year')){box.innerHTML='<div class="empty"><h3>A little space for what’s next.</h3><p>Primary subjects and materials haven’t been added yet.</p></div>';return}box.className='subject-grid';box.innerHTML=Object.entries(subjects).map(([key,name])=>{let n=matching({level:s.level,subject:key}).length;return `<button class="level-card ${n?'ready':''}" data-subject="${key}"><span class="tag">${escape(name)}</span><strong>${key}</strong><span class="card-bottom">${countLabel(n)} <span class="arrow">↗</span></span></button>`}).join('');box.querySelectorAll('button').forEach(b=>b.onclick=()=>{selection.subject=b.dataset.subject;renderLibrary()});}
 else if(!s.month){$('#sectionTitle').textContent='Choose a month';$('#sectionMeta').textContent='12 MONTHS';box.className='month-grid';box.innerHTML=months.map((name,i)=>{let n=matching({...s,month:i+1}).length;return `<button class="month-card ${n?'ready':''}" data-month="${i+1}"><span class="month-no">${String(i+1).padStart(2,'0')}</span><span><strong>${name}</strong><small>${n?countLabel(n):'No materials yet'}</small></span></button>`}).join('');box.querySelectorAll('button').forEach(b=>b.onclick=()=>{selection.month=+b.dataset.month;renderLibrary()});}
 else{const list=matching(s);$('#sectionTitle').textContent=`${months[s.month-1]} lessons`;$('#sectionMeta').textContent=`${list.length} MATERIAL${list.length===1?'':'S'}`;box.className='material-list';box.innerHTML=list.length?list.map(m=>m.type==='audio'?`<article class="material-card audio-card"><div class="audio-head"><span class="file-icon audio">MP3</span><span class="material-info"><strong>${escape(m.title)}</strong><small>${escape(m.detail||'Listening recording · Tap play to listen')}</small></span></div><div class="audio-controls"><audio controls preload="metadata" src="assets/materials/${escape(m.file)}" aria-label="Play ${escape(m.title)}">Audio playback is not supported in this browser.</audio><a class="download-pdf" href="assets/materials/${escape(m.file)}" download="${escape(m.original)}" aria-label="Download audio: ${escape(m.title)}">↓ Download MP3</a></div></article>`:`<article class="material-card"><button class="material-open" data-material="${m.id}"><span class="file-icon ${m.type}">${m.type.toUpperCase()}</span><span class="material-info"><strong>${escape(m.title)}</strong><small>${escape(m.detail||'PDF booklet · Write and highlight on every page')}</small></span><span class="open-label">Open lesson ↗</span></button>${m.type==='pdf'?`<a class="download-pdf" href="assets/materials/${escape(m.file)}" download="${escape(m.original)}" aria-label="Download PDF: ${escape(m.title)}">↓ Download PDF</a>`:''}</article>`).join(''):'<div class="empty"><h3>A fresh page awaits.</h3><p>No materials for this month yet. Choose another month.</p></div>';box.querySelectorAll('button').forEach(b=>b.onclick=()=>openMaterial(materials.find(m=>m.id===b.dataset.material)));}}
$('#loginForm').onsubmit=e=>{e.preventDefault();if($('#password').value==='iamtheonlyadmin'){$('#login').hidden=true;$('#library').hidden=false;$('#password').value='';syncPassword();$('#loginError').textContent='';renderLibrary();$('#home').focus()}else{$('#loginError').textContent='That password didn’t match. Please try again.';$('#password').focus()}};
$('#lock').onclick=()=>{$('#library').hidden=true;$('#login').hidden=false;$('#password').focus()};
$('#home').onclick=e=>{e.preventDefault();selection={level:null,subject:null,month:null};renderLibrary()};
function setTool(tool){
 settings.tool=tool;
 // Attach immediately: a newly selected HTML deck might not have had its
 // first delayed background sync yet.
 if(current?.type==='html')syncDeck();
 deckSelection?.set(tool!=='interact');
 document.querySelectorAll('[data-tool]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.tool===tool));
 for(const layer of layers.values())layer.update();
 const drawing=tool!=='interact';
 const badge=$('#drawModeBadge');
 if(badge){
   badge.hidden=!drawing;
   badge.textContent=tool==='pen'?'✎ Pen · Finger or Apple Pencil':
     tool==='highlight'?'▰ Mark · Finger or Apple Pencil':
     tool==='text'?'T Text · Tap to type, drag to move, ◢ to resize':
     '⌫ Erase · Rub across ink';
 }
 $('#toolHint').textContent=!drawing
  ? 'Move mode · Scroll, pinch and tap lesson answers normally.'
  : tool==='text'
   ? 'Tap the page to type. Drag ⠿ to move; drag ◢ to change text size. Choose Move to read.'
  : tool==='erase'
   ? 'Erase your pen or highlight strokes with one finger or Apple Pencil. Switch to Move for scrolling.'
   : 'Draw with one finger or Apple Pencil. Use Move to scroll and pinch the lesson.';
}
for(const b of document.querySelectorAll('[data-tool]'))b.onclick=()=>setTool(b.dataset.tool);
$('#ink').oninput=e=>{settings.color=e.target.value};$('#penSize').onchange=e=>{settings.size=+e.target.value};$('#fingerDraw').checked=settings.finger;$('#fingerDraw').onchange=e=>{settings.finger=e.target.checked;setTool(settings.tool)};
$('#undo').onclick=()=>active?.undo();$('#clearInk').onclick=()=>active?.clear();
function updateUndo(){
 $('#undo').disabled=!(active?.actions.length||active?.history.length);
 $('#clearInk').disabled=!(active?.strokes.length||active?.text?.notes.length);
}
function attach(target,key){
 let layer=layers.get(key);
 if(!layer||!layer.svg.isConnected){
   const old=layer;
   layer=new InkLayer(target,()=>settings,changed=>{active=changed;updateUndo()});
   if(old){
     const oldNotes=old.text.snapshot();
     layer.strokes=old.strokes;layer.history=old.history;layer.actions=old.actions;
     old.destroy();layer.text.restore(oldNotes);layer.draw();
   }
   layers.set(key,layer);
 }
 // Do not reset the current writing page every 120 ms (this previously made
 // Undo point at an unrelated page in decks with many annotation layers).
 if(!active){active=layer;updateUndo()}
 return layer;
}
function status(message){$('#loadStatus').textContent=message;$('#loadStatus').hidden=!message}
async function openMaterial(m){closeMaterial(false);current=m;const token=++epoch;$('#viewer').hidden=false;$('#library').hidden=true;document.body.classList.add('reading-open');$('#materialTitle').textContent=m.title;$('#materialMeta').textContent=`${m.level} / ${m.subject} / ${months[m.month-1]} · ${m.type.toUpperCase()}`;status('Opening your lesson…');setTool('interact');$('#closeViewer').focus();
 if(m.type==='html'){$('#deck').hidden=false;$('#deck').onload=()=>{if(token!==epoch)return;const frame=$('#deck');try{const d=frame.contentDocument;if(!d?.querySelector('script'))throw Error('Lesson missing');fullMode.connectDeck(d);deckSelection=selectionGuard(d.body);deckSelection.set(settings.tool!=='interact');status('');syncDeck();deckTimer=setInterval(syncDeck,120)}catch{status('This lesson could not open. Close it and try again.')}};$('#deck').src='assets/materials/'+m.file;}
 else{$('#pdfBadge').hidden=false;$('#pdfBadge').textContent='…';$('#pdfControls').hidden=false;$('#pdfScroll').hidden=false;try{const pdfjs=await import('./assets/vendor/pdf.mjs');if(token!==epoch)return;pdfjs.GlobalWorkerOptions.workerSrc=new URL('./assets/vendor/pdf.worker.mjs',import.meta.url).href;loadingTask=pdfjs.getDocument({url:'assets/materials/'+m.file,cMapUrl:'assets/vendor/cmaps/',cMapPacked:true,standardFontDataUrl:'assets/vendor/standard_fonts/'});const loaded=await loadingTask.promise;if(token!==epoch){await loaded.destroy();return}doc=loaded;$('#pageTotal').textContent=`of ${doc.numPages}`;$('#pageNumber').max=doc.numPages;reader=new PDFReader($('#pdfScroll'),doc,{layerFor:(target,n)=>attach(target,'pdf-'+n),settings:()=>settings,onPage:(n,layer)=>{$('#pdfBadge').textContent=`${n} / ${doc.numPages}`;if(document.activeElement!==$('#pageNumber'))$('#pageNumber').value=n;active=layer;updateUndo()},onZoom:z=>{$('#zoomLabel').textContent=Math.round(z*100)+'%'}});await reader.init();if(token===epoch)status('')}catch(e){if(token===epoch){status('Unable to open this PDF. Please close it and try again.');console.error(e)}}}}
function syncDeck(){
 if(current?.type!=='html')return;
 try{
   const d=$('#deck').contentDocument;
   if(!d?.body)return;
   const targets=annotationTargets(d);
   for(const t of targets)attach(t.element,'html:'+t.key);
   // Track the visible page for Undo, but never interrupt an active stroke.
   const nearest=nearestVisibleTarget(d,targets);
   const selected=nearest && layers.get('html:'+nearest.key);
   if(selected && selected!==active && active?.pointer==null){
     active=selected;updateUndo();
   }
 }catch(err){console.warn('Unable to attach drawing canvas to this deck',err)}
}
$('#viewerMore').onclick=()=>{const open=$('#viewerOptions').hidden;$('#viewerOptions').hidden=!open;$('#viewerMore').setAttribute('aria-expanded',String(open))};
$('#pageNumber').onchange=e=>reader?.goTo(+e.target.value);
$('#fitPage').onclick=()=>reader?.zoomAt(1);
function closeMaterial(show=true){
 epoch++;clearInterval(deckTimer);deckTimer=null;
 reader?.destroy();reader=null;deckSelection?.destroy();deckSelection=null;
 $('#viewerOptions').hidden=true;$('#viewerMore').setAttribute('aria-expanded','false');
 $('#pdfBadge').hidden=true;
 loadingTask?.destroy().catch(()=>{});loadingTask=null;doc=null;
 for(const l of layers.values())l.destroy();layers.clear();active=null;current=null;
 fullMode.set(false);document.body.classList.remove('reading-open');
 $('#zoomLabel').textContent='100%';$('#pageNumber').value=1;
 $('#deck').onload=null;$('#deck').src='about:blank';$('#deck').hidden=true;
 $('#pdfScroll').hidden=true;$('#pdfControls').hidden=true;$('#viewer').hidden=true;
 if(show){$('#library').hidden=false;renderLibrary();$('#choices [data-material]')?.focus()}
}
$('#closeViewer').onclick=()=>closeMaterial();
window.addEventListener('pagehide',()=>closeMaterial(false));
