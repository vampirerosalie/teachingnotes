// Deliberately use an in-page mode: Safari's native fullscreen swipe-to-exit cannot be disabled.
export function readingMode(viewer, button) {
  let expanded = false;
  const deckButtons = new Map();
  function set(value) {
    expanded = value; viewer.classList.toggle('reading-full', value);
    button.textContent = value ? 'Exit full screen' : 'Full screen';
    button.setAttribute('aria-pressed', String(value));
    if(value){const options=viewer.querySelector('#viewerOptions');if(options)options.hidden=true;viewer.querySelector('#viewerMore')?.setAttribute('aria-expanded','false');}
    for (const [b, originalLabel] of deckButtons) {
      if (!b.isConnected) { deckButtons.delete(b); continue; }
      b.textContent = value ? 'Exit full screen' : originalLabel;
      b.setAttribute('aria-pressed', String(value));
    }
  }
  const toggle = () => set(!expanded);
  button.onclick = toggle;
  function connectDeck(doc) {
    const buttons = doc.querySelectorAll('#full, button[onclick*="toggleFullScreen"], button[onclick*="requestFullscreen"]');
    for (const b of buttons) {
      deckButtons.set(b, b.textContent);
      b.addEventListener('click', e => { e.preventDefault(); e.stopImmediatePropagation(); toggle(); }, true);
    }
    doc.addEventListener('keydown', e => {
      if (e.target.closest('input,textarea,select,[contenteditable]')) return;
      if (e.key.toLowerCase() === 'f') { e.preventDefault(); e.stopImmediatePropagation(); toggle(); }
    }, true);
    set(expanded);
  }
  return {set, connectDeck};
}
