// Locate the actual teaching surface in every HTML deck format used by the library.
// The original viewer recognised only #slide and .slide.active .content. Newer decks
// use .page sheets and .screen.active (email writing), so Pen had no SVG to draw on.
export function annotationTargets(doc) {
  if (!doc?.body) return [];
  const single = doc.querySelector('#slide');
  if (single) {
    const label = doc.querySelector('#position')?.textContent?.trim() ||
      single.dataset.page || single.dataset.title || '0';
    return [{element: single, key: 'legacy-slide:' + label}];
  }

  const slides = Array.from(doc.querySelectorAll('.slide'));
  if (slides.length) {
    const active = doc.querySelector('.slide.active') ||
      slides.find(el => el.classList.contains('current')) ||
      (slides.length === 1 ? slides[0] : null);
    if (!active) return [];
    const n = slides.indexOf(active);
    return [{element: active.querySelector('.content') || active, key: 'slide:' + n}];
  }

  const screens = Array.from(doc.querySelectorAll('.screen'));
  if (screens.length) {
    const active = doc.querySelector('.screen.active') ||
      (screens.length === 1 ? screens[0] : null);
    if (!active) return [];
    return [{element: active, key: 'screen:' + screens.indexOf(active)}];
  }

  // Reading / Grammar decks have many consecutive pages in one scroll container.
  // Give every page its own annotation layer so scrolling never moves ink onto
  // another page; the browser can reflow/zoom each page independently.
  const pages = Array.from(doc.querySelectorAll('#deck > .page, .page'));
  if (pages.length) {
    return pages
      .filter((el, i) => pages.indexOf(el) === i)
      .map((element, i) => ({element, key: 'page:' + i}));
  }

  return [];
}

// For a multi-page scrolling deck, the currently viewed sheet should own Undo.
export function nearestVisibleTarget(doc, targets) {
  if (!targets.length) return null;
  if (targets.length === 1) return targets[0];
  const viewportMid = (doc.defaultView?.innerHeight || doc.documentElement?.clientHeight || 768) / 2;
  let best = targets[0], distance = Infinity;
  for (const item of targets) {
    const r = item.element.getBoundingClientRect();
    if (!r.width || !r.height) continue;
    const margin = Math.max(0, Math.min(r.top, Math.abs(r.bottom - viewportMid)));
    const d = r.top <= viewportMid && r.bottom >= viewportMid
      ? 0 : Math.abs((r.top + r.bottom) / 2 - viewportMid) + margin * .01;
    if (d < distance) { best = item; distance = d; }
  }
  return best;
}
