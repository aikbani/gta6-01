// Keyboard + mouse input. WASD drive / move, Space handbrake, Shift run,
// F enter/exit car, E steal, 1/2/3 weapons, R radio, M mission, Esc pause.
// Mouse drag (or pointer lock on click) orbits the camera; click shoots.
export class Input {
  constructor(canvas) {
    this.keys = new Set();
    this.mouseDX = 0; this.mouseDY = 0;
    this.mouseDown = false; this.mouseClicked = false;
    this.dragging = false; this.lastX = 0; this.lastY = 0;
    this._pressed = new Set(); // edge-triggered keys, consumed each frame
    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      this.keys.add(e.code);
      this._pressed.add(e.code);
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => { this.keys.clear(); this.mouseDown = false; });
    canvas.addEventListener('mousedown', (e) => {
      this.mouseDown = true; this.mouseClicked = true;
      this.dragging = true; this.lastX = e.clientX; this.lastY = e.clientY;
      if (document.pointerLockElement !== canvas) canvas.requestPointerLock?.();
    });
    window.addEventListener('mouseup', () => { this.mouseDown = false; this.dragging = false; });
    window.addEventListener('mousemove', (e) => {
      if (document.pointerLockElement === canvas) {
        this.mouseDX += e.movementX; this.mouseDY += e.movementY;
      } else if (this.dragging) {
        this.mouseDX += e.clientX - this.lastX; this.mouseDY += e.clientY - this.lastY;
        this.lastX = e.clientX; this.lastY = e.clientY;
      }
    });
    // Touch: left half = move stick, right half = camera drag, tap = action.
    this.touch = { active: false, mx: 0, my: 0, cx: 0, cy: 0 };
    canvas.addEventListener('touchstart', (e) => {
      const t = e.changedTouches[0];
      this.touch.active = true; this.touch.mx = t.clientX; this.touch.my = t.clientY;
      this.touch.cx = t.clientX; this.touch.cy = t.clientY; e.preventDefault();
    }, { passive: false });
    canvas.addEventListener('touchmove', (e) => {
      const t = e.changedTouches[0];
      this.touch.cx = t.clientX; this.touch.cy = t.clientY; e.preventDefault();
    }, { passive: false });
    canvas.addEventListener('touchend', () => { this.touch.active = false; });
  }
  down(code) { return this.keys.has(code); }
  pressed(code) { return this._pressed.has(code); }
  // Driving axes: -1..1 throttle (W/S), steering (A/D).
  driveAxes() {
    let throttle = 0, steer = 0;
    if (this.down('KeyW') || this.down('ArrowUp')) throttle += 1;
    if (this.down('KeyS') || this.down('ArrowDown')) throttle -= 1;
    if (this.down('KeyA') || this.down('ArrowLeft')) steer -= 1;
    if (this.down('KeyD') || this.down('ArrowRight')) steer += 1;
    if (this.touch.active) {
      const dx = this.touch.cx - this.touch.mx, dy = this.touch.cy - this.touch.my;
      throttle += Math.max(-1, Math.min(1, -dy / 60));
      steer += Math.max(-1, Math.min(1, dx / 60));
    }
    return { throttle, steer, handbrake: this.down('Space'), run: this.down('ShiftLeft') || this.down('ShiftRight') };
  }
  moveAxes() {
    let x = 0, z = 0;
    if (this.down('KeyW') || this.down('ArrowUp')) z -= 1;
    if (this.down('KeyS') || this.down('ArrowDown')) z += 1;
    if (this.down('KeyA') || this.down('ArrowLeft')) x -= 1;
    if (this.down('KeyD') || this.down('ArrowRight')) x += 1;
    if (this.touch.active) {
      x += Math.max(-1, Math.min(1, (this.touch.cx - this.touch.mx) / 60));
      z += Math.max(-1, Math.min(1, (this.touch.cy - this.touch.my) / 60));
    }
    return { x, z, run: this.down('ShiftLeft') || this.down('ShiftRight') };
  }
  consumeMouse() { const dx = this.mouseDX, dy = this.mouseDY; this.mouseDX = 0; this.mouseDY = 0; return { dx, dy }; }
  endFrame() { this._pressed.clear(); this.mouseClicked = false; }
}
