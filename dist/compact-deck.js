// Keep original teaching files intact; simplify their chrome only inside this viewer.
export function compactDeck(doc, controls) {
  const science = !!doc.querySelector('#slide');
  const style = doc.createElement('style');
  style.textContent = `
    html,body{overscroll-behavior:none}
    body:not(.lesson-controls-open)>header,body:not(.lesson-controls-open)>.toolbar,
    body:not(.lesson-controls-open)>.controls,body>footer{display:none!important}
    #full,button[onclick*="toggleFullScreen"]{display:none!important}
    .slide{padding-bottom:18px!important;height:100dvh!important}
    body.lesson-controls-open .slide{padding-bottom:80px!important}
    body.lesson-controls-open>.controls{padding:4px 8px!important;min-height:44px!important}
    body.lesson-controls-open>.controls button{padding:7px 10px!important;font-size:14px!important}
    body.lesson-controls-open>header{padding:6px 12px!important}
    body.lesson-controls-open>.toolbar{padding:5px 10px!important}
    #sizer{margin-top:12px!important;margin-bottom:12px!important}
  `;
  doc.head.append(style);
  const find = action => science
    ? doc.querySelector({prev:'#prev',next:'#next',reveal:'#reveal'}[action])
    : doc.querySelector(`button[onclick="${{prev:'prevSlide()',next:'nextSlide()',reveal:'revealAnswer()'}[action]}"]`);
  for (const action of ['prev','next','reveal']) controls[action].onclick = () => { find(action)?.click(); sync(); };
  controls.more.setAttribute('aria-pressed','false');controls.more.textContent='Show lesson controls';
  controls.more.onclick = () => {
    const show=doc.body.classList.toggle('lesson-controls-open');
    controls.more.setAttribute('aria-pressed',String(show));
    controls.more.textContent=show?'Hide lesson controls':'Show lesson controls';
    // Original decks recalculate their transformed slide sizes on resize.
    doc.defaultView.dispatchEvent(new doc.defaultView.Event('resize'));
  };
  function sync() {
    const label=doc.querySelector(science?'#position':'#progress')?.textContent||'';
    controls.position.textContent=label;
    const [n,total]=label.split('/').map(Number);
    controls.prev.disabled=!!find('prev')?.disabled||n===1;
    controls.next.disabled=!!find('next')?.disabled||n===total;
    const reveal=find('reveal');controls.reveal.disabled=!reveal;
    controls.reveal.textContent=reveal?.textContent?.startsWith('Hide')?'Hide answer':'Answer';
  }
  sync();
  doc.defaultView.dispatchEvent(new doc.defaultView.Event('resize'));
  return {sync};
}
