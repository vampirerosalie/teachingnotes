// PDF gestures are scoped to the reading surface, never the toolbar or login.
export class TouchNavigator {
  constructor(surface, {getZoom, zoomAt, canDraw, cancelInk, settled, isPenActive = () => false}) {
    this.surface = surface;
    this.options = {getZoom, zoomAt, canDraw, cancelInk, settled, isPenActive};
    this.points = new Map();
    this.ignoredTouches = new Set();
    this.mode = null;
    this.velocity = [0, 0];
    this.frame = 0;
    this.handlers = {
      pointerdown: e => this.down(e), pointermove: e => this.move(e),
      pointerup: e => this.end(e), pointercancel: e => this.end(e),
      lostpointercapture: e => this.end(e),
    };
    for (const [name, handler] of Object.entries(this.handlers)) surface.addEventListener(name, handler, {capture: true, passive: false});
  }
  local(e) { const r = this.surface.getBoundingClientRect(); return {x: e.clientX - r.left, y: e.clientY - r.top}; }
  pair() {
    const [a, b] = [...this.points.values()];
    return {x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, distance: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y))};
  }
  capture(id) { try { this.surface.setPointerCapture(id); } catch {} }
  down(e) {
    if (e.pointerType === 'pen') {
      // Stop momentum and quarantine a resting hand before the ink layer starts its stroke.
      cancelAnimationFrame(this.frame); this.frame=0;
      for (const id of this.points.keys()) this.ignoredTouches.add(id);
      this.points.clear(); this.mode=null; this.velocity=[0,0];
      return;
    }
    if (e.pointerType !== 'touch' || e.target?.closest?.('button,input,select,a')) return;
    if (this.options.isPenActive()) {
      this.ignoredTouches.add(e.pointerId);e.preventDefault();e.stopPropagation();return;
    }
    cancelAnimationFrame(this.frame);
    this.points.set(e.pointerId, this.local(e));
    this.velocity = [0, 0];
    this.lastTime = e.timeStamp;
    if (this.points.size >= 2) {
      this.options.cancelInk();
      this.mode = 'pinch'; this.pinch = this.pair();
      for (const id of this.points.keys()) this.capture(id);
    } else {
      this.mode = this.options.canDraw() ? 'ink' : 'pan';
      if (this.mode === 'pan') this.capture(e.pointerId);
    }
    if (this.mode !== 'ink') { e.preventDefault(); e.stopPropagation(); }
  }
  move(e) {
    if(this.ignoredTouches.has(e.pointerId)){e.preventDefault();e.stopPropagation();return;}
    if (!this.points.has(e.pointerId)) return;
    const previous = this.points.get(e.pointerId), point = this.local(e);
    this.points.set(e.pointerId, point);
    if (this.mode === 'ink') return;
    e.preventDefault(); e.stopPropagation();
    if (this.mode === 'pinch' && this.points.size >= 2) {
      const next = this.pair();
      this.options.zoomAt(this.options.getZoom() * next.distance / this.pinch.distance, this.pinch, next);
      this.pinch = next;
    } else {
      const dx = previous.x - point.x, dy = previous.y - point.y;
      this.surface.scrollLeft += dx; this.surface.scrollTop += dy;
      const dt = Math.max(1, e.timeStamp - this.lastTime);
      this.velocity = [dx, dy].map(v => Math.max(-3, Math.min(3, v / dt)));
    }
    this.lastTime = e.timeStamp;
  }
  end(e) {
    if(this.ignoredTouches.delete(e.pointerId)){e.preventDefault();e.stopPropagation();return;}
    if (!this.points.has(e.pointerId)) return;
    // Transferring capture from an ink layer to the scroll surface must not end a pinch.
    if (e.type === 'lostpointercapture' && (e.target !== this.surface || this.surface.hasPointerCapture?.(e.pointerId))) return;
    const was = this.mode;
    this.points.delete(e.pointerId);
    if (was !== 'ink') { e.preventDefault(); e.stopPropagation(); }
    if (this.points.size >= 2) { this.pinch = this.pair(); return; }
    if (this.points.size === 1) { this.mode = 'pan'; this.velocity = [0, 0]; return; }
    this.mode = null;
    this.options.settled();
    if (was === 'pan' && e.type === 'pointerup' && e.timeStamp - this.lastTime < 100) this.coast();
  }
  coast() {
    let last = performance.now();
    const step = now => {
      const dt = Math.min(32, now - last); last = now;
      const beforeX = this.surface.scrollLeft, beforeY = this.surface.scrollTop;
      this.surface.scrollLeft += this.velocity[0] * dt;
      this.surface.scrollTop += this.velocity[1] * dt;
      const friction = Math.pow(.93, dt / 16);
      this.velocity = this.velocity.map(v => v * friction);
      if (this.surface.scrollLeft === beforeX) this.velocity[0] = 0;
      if (this.surface.scrollTop === beforeY) this.velocity[1] = 0;
      if (Math.hypot(...this.velocity) > .025) this.frame = requestAnimationFrame(step);
    };
    this.frame = requestAnimationFrame(step);
  }
  destroy() {
    cancelAnimationFrame(this.frame);
    for (const [name, handler] of Object.entries(this.handlers)) this.surface.removeEventListener(name, handler, true);
    this.points.clear(); this.ignoredTouches.clear();
  }
}
