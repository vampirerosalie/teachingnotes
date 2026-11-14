import {TouchNavigator} from './gestures.js?v=3.1';
const GUTTER = 16, GAP = 20, MAX_CANVASES = 5;
export const limitZoom = z => Math.max(.5, Math.min(4, z));

// All page shells remain in the document. Only nearby raster canvases consume memory.
export class PDFReader {
  constructor(surface, doc, {layerFor, settings, onPage, onZoom}) {
    this.surface = surface; this.doc = doc;
    this.options = {layerFor, settings, onPage, onZoom};
    this.pages = []; this.zoom = 1; this.alive = true; this.wanted = [];
    this.currentPage = 0; this.busy = false; this.frame = 0;
    this.space = document.createElement('div'); this.space.className = 'pdf-space';
    this.column = document.createElement('div'); this.column.className = 'pdf-pages';
    this.space.append(this.column); surface.replaceChildren(this.space);
    this.gestures = new TouchNavigator(surface, {
      getZoom: () => this.zoom,
      zoomAt: (z, from, to) => this.zoomAt(z, from, to),
      canDraw: () => settings().finger && settings().tool !== 'interact',
      cancelInk: () => this.pages.forEach(p => p.layer?.cancel()),
      isPenActive: () => this.pages.some(p => p.layer?.pointerType === 'pen' && p.layer.pointer !== null),
      settled: () => this.schedule(),
    });
    this.scrollHandler = () => this.schedule();
    surface.addEventListener('scroll', this.scrollHandler, {passive: true});
    this.wheelHandler = e => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      const r = surface.getBoundingClientRect();
      this.zoomAt(this.zoom * Math.exp(-e.deltaY * .01), {x: e.clientX - r.left, y: e.clientY - r.top});
    };
    surface.addEventListener('wheel', this.wheelHandler, {passive: false});
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(surface);
  }
  async init() {
    // Get page dimensions without rasterizing the document or allocating large canvases.
    for (let number = 1; number <= this.doc.numPages; number++) {
      const pdf = await this.doc.getPage(number);
      if (!this.alive) return;
      const viewport = pdf.getViewport({scale: 1});
      const element = document.createElement('article'); element.className = 'pdf-page';
      element.setAttribute('aria-label', `PDF page ${number}`);
      element.dataset.page = number;
      const placeholder = document.createElement('span'); placeholder.className = 'pdf-placeholder';
      placeholder.textContent = `Page ${number}`;
      element.append(placeholder); this.column.append(element);
      const p = {number, pdf, element, placeholder, aspect: viewport.height / viewport.width, naturalWidth: viewport.width, canvas: null, renderedScale: 0};
      this.pages.push(p); p.layer = this.options.layerFor(element, number);
    }
    this.resize(); this.schedule();
  }
  resize() {
    if (!this.alive || !this.pages.length) return;
    const width = Math.max(200, this.surface.clientWidth - GUTTER * 2);
    // Preserve a document coordinate when rotating the iPad; changing toolbar height needs no reflow.
    const oldWidth = this.baseWidth || width, oldTop = Math.max(0, this.surface.scrollTop - GUTTER);
    const oldLeft = this.surface.scrollLeft;
    this.baseWidth = width;
    let top = 0;
    for (const p of this.pages) {
      p.top = top; p.height = width * p.aspect;
      p.element.style.width = width + 'px'; p.element.style.height = p.height + 'px';
      top += p.height + GAP;
    }
    this.baseHeight = top - GAP;
    this.column.style.width = width + 'px';
    this.column.style.height = this.baseHeight + 'px';
    this.layout();
    if (width !== oldWidth) {
      this.surface.scrollTop = GUTTER + oldTop * width / oldWidth;
      this.surface.scrollLeft = oldLeft * width / oldWidth;
    }
    this.schedule();
  }
  layout() {
    this.originX = Math.max(GUTTER, (this.surface.clientWidth - this.baseWidth * this.zoom) / 2);
    this.space.style.width = Math.max(this.surface.clientWidth, this.baseWidth * this.zoom + GUTTER * 2) + 'px';
    this.space.style.height = this.baseHeight * this.zoom + GUTTER * 2 + 'px';
    this.column.style.left = this.originX + 'px'; this.column.style.top = GUTTER + 'px';
    this.column.style.transform = `scale(${this.zoom})`;
  }
  zoomAt(value, from = {x: this.surface.clientWidth / 2, y: this.surface.clientHeight / 2}, to = from) {
    if (!this.pages.length) return;
    const x = (this.surface.scrollLeft + from.x - this.originX) / this.zoom;
    const y = (this.surface.scrollTop + from.y - GUTTER) / this.zoom;
    this.zoom = limitZoom(value); this.layout();
    this.surface.scrollLeft = this.originX + x * this.zoom - to.x;
    this.surface.scrollTop = GUTTER + y * this.zoom - to.y;
    this.options.onZoom(this.zoom); this.schedule();
  }
  goTo(number) {
    const p = this.pages[Math.max(0, Math.min(this.pages.length - 1, Math.round(number) - 1 || 0))];
    if (!p) return;
    this.surface.scrollTop = GUTTER + p.top * this.zoom;
    this.schedule();
  }
  schedule() {
    if (!this.alive || this.frame) return;
    this.frame = requestAnimationFrame(() => { this.frame = 0; this.refresh(); });
  }
  refresh() {
    if (!this.alive || !this.pages.length) return;
    const top = (this.surface.scrollTop - GUTTER) / this.zoom;
    const bottom = top + this.surface.clientHeight / this.zoom, middle = (top + bottom) / 2;
    const near = this.pages.map(p => ({p, distance: Math.max(p.top - middle, middle - p.top - p.height, 0)})).sort((a, b) => a.distance - b.distance);
    const current = near[0].p;
    if (this.currentPage !== current.number) { this.currentPage = current.number; this.options.onPage(current.number, current.layer); }
    this.wanted = near.filter(({p}) => p.top < bottom + 500 / this.zoom && p.top + p.height > top - 500 / this.zoom).slice(0, MAX_CANVASES).map(({p}) => p);
    for (const p of this.pages) if (p.canvas && !this.wanted.includes(p)) this.release(p);
    if (this.taskPage && !this.wanted.includes(this.taskPage)) this.renderTask?.cancel();
    // CSS transforms follow the fingers immediately. Raster refinement waits until the pinch settles.
    if (this.gestures.mode !== 'pinch') this.pump();
  }
  rasterScale(p) {
    return Math.min(this.baseWidth / p.naturalWidth * this.zoom * Math.min(devicePixelRatio || 1, 2), Math.sqrt(3000000 / (p.naturalWidth ** 2 * p.aspect)));
  }
  async pump() {
    if (this.busy || !this.alive) return;
    this.busy = true;
    try {
      while (this.alive && this.gestures.mode !== 'pinch') {
        const p = this.wanted.find(p => !p.failed && (!p.canvas || Math.abs(p.renderedScale - this.rasterScale(p)) > .01));
        if (!p) break;
        const scale = this.rasterScale(p), viewport = p.pdf.getViewport({scale});
        const canvas = document.createElement('canvas');
        canvas.setAttribute('aria-label', `PDF page ${p.number}`);
        canvas.width = Math.ceil(viewport.width); canvas.height = Math.ceil(viewport.height);
        this.taskPage = p;
        try {
          this.renderTask = p.pdf.render({canvasContext: canvas.getContext('2d'), viewport});
          await this.renderTask.promise;
          if (!this.alive || !this.wanted.includes(p)) { canvas.width = canvas.height = 0; continue; }
          this.release(p);
          p.canvas = canvas; p.renderedScale = scale;
          p.placeholder.hidden = true; p.element.prepend(canvas);
        } catch (error) {
          canvas.width = canvas.height = 0;
          if (error.name !== 'RenderingCancelledException' && this.alive) {
            p.failed = true; p.placeholder.hidden = false;
            const retry = document.createElement('button'); retry.textContent = `Retry page ${p.number}`;
            retry.onclick = () => { p.failed = false; p.placeholder.textContent = `Loading page ${p.number}…`; this.schedule(); };
            p.placeholder.replaceChildren(retry); console.error(error);
          }
        } finally { this.renderTask = null; this.taskPage = null; }
      }
    } finally { this.busy = false; }
  }
  release(p) {
    if (p.canvas) { p.canvas.width = p.canvas.height = 0; p.canvas.remove(); p.canvas = null; }
    p.renderedScale = 0; p.placeholder.hidden = false;
  }
  destroy() {
    this.alive = false; cancelAnimationFrame(this.frame); this.renderTask?.cancel();
    this.gestures.destroy(); this.resizeObserver.disconnect();
    this.surface.removeEventListener('scroll', this.scrollHandler);
    this.surface.removeEventListener('wheel', this.wheelHandler);
    this.pages.forEach(p => this.release(p)); this.surface.replaceChildren();
  }
}
