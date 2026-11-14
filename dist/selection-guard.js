const EDITABLE = 'input,textarea,select,[contenteditable]:not([contenteditable="false"])';
// Suppress Safari's native selection/callout only on the reader's non-editable surfaces.
export function selectionGuard(root) {
  const doc=root.ownerDocument, win=doc.defaultView;
  const style=doc.createElement('style');
  style.textContent=`
    .no-browser-selection,.no-browser-selection *{user-select:none!important;-webkit-user-select:none!important;-webkit-touch-callout:none!important}
    .no-browser-selection input,.no-browser-selection textarea,.no-browser-selection select,.no-browser-selection [contenteditable]:not([contenteditable="false"]){user-select:text!important;-webkit-user-select:text!important}
    .no-browser-selection canvas,.no-browser-selection svg{-webkit-user-drag:none}
  `;
  doc.head.append(style);
  let active=false;
  const editable=e=>e.target?.closest?.(EDITABLE);
  const block=e=>{if(active && !editable(e)) e.preventDefault();};
  const clear=e=>{if(active && !editable(e)) win.getSelection?.()?.removeAllRanges();};
  for(const name of ['selectstart','dragstart','contextmenu']) root.addEventListener(name,block,{capture:true,passive:false});
  root.addEventListener('pointerdown',clear,true);
  return {
    set(enabled){active=enabled;root.classList.toggle('no-browser-selection',enabled);if(enabled)win.getSelection?.()?.removeAllRanges();},
    destroy(){for(const name of ['selectstart','dragstart','contextmenu'])root.removeEventListener(name,block,true);root.removeEventListener('pointerdown',clear,true);root.classList.remove('no-browser-selection');style.remove();}
  };
}
