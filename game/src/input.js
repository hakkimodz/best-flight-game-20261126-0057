// Merapi Ridge Run — input. Keyboard is the primary control; the mouse
// steers while it moves and the wheel works the throttle, and the title
// screen's mission cards are clickable. Every control the game lists works.

export class Input {
  constructor(canvas, hooks) {
    this.canvas = canvas;
    this.hooks = hooks; // { onAction(name), onSelectMission(i), onClick(x,y) }
    this.keys = new Set();
    this.mouseSteer = { x: 0, y: 0, active: false, until: 0 };
    this.wheelDelta = 0;

    window.addEventListener('keydown', (e) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault();
      if (e.repeat) return;
      this.keys.add(e.key.length === 1 ? e.key.toLowerCase() : e.key);
      this.hooks.onAction(this.actionFor(e.key));
    });
    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.key.length === 1 ? e.key.toLowerCase() : e.key);
    });
    window.addEventListener('blur', () => this.keys.clear());

    canvas.addEventListener('pointermove', (e) => {
      const rect = canvas.getBoundingClientRect();
      const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const ny = ((e.clientY - rect.top) / rect.height) * 2 - 1;
      this.mouseSteer = { x: nx, y: ny, active: true, until: performance.now() + 2500 };
    });
    canvas.addEventListener('pointerdown', (e) => {
      const rect = canvas.getBoundingClientRect();
      this.hooks.onClick(e.clientX - rect.left, e.clientY - rect.top);
    });
    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.wheelDelta += e.deltaY;
    }, { passive: false });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  actionFor(key) {
    if (key === 'Enter') return 'start';
    if (key === 'p' || key === 'P') return 'pause';
    if (key === 'r' || key === 'R') return 'restart';
    if (key === 'm' || key === 'M') return 'mute';
    if (key === '1') return 'mission-0';
    if (key === '2') return 'mission-1';
    if (key === '3') return 'mission-2';
    return null;
  }

  // The stick: -1..1 pitch (pull up positive) and roll (right positive),
  // throttle delta per second, and the brake. Mouse steering blends in
  // gently and fades out two and a half seconds after the mouse stops.
  read(dt) {
    const k = this.keys;
    let pitch = 0;
    let roll = 0;
    if (k.has('ArrowUp') || k.has('w')) pitch += 1;
    if (k.has('ArrowDown') || k.has('s')) pitch -= 1;
    if (k.has('ArrowLeft') || k.has('a')) roll -= 1;
    if (k.has('ArrowRight') || k.has('d')) roll += 1;

    const now = performance.now();
    if (this.mouseSteer.active && now < this.mouseSteer.until) {
      // Mouse position steers: up on screen is nose up, right is bank right.
      pitch += -this.mouseSteer.y * 0.7;
      roll += this.mouseSteer.x * 0.8;
    } else if (now >= this.mouseSteer.until) {
      this.mouseSteer.active = false;
    }

    let throttleDelta = 0;
    if (k.has('Shift')) throttleDelta += 1;
    if (k.has('Control')) throttleDelta -= 1;
    if (this.wheelDelta !== 0) {
      throttleDelta += -Math.sign(this.wheelDelta) * 0.5;
      this.wheelDelta = 0;
    }
    const brake = k.has(' ');
    return {
      pitch: Math.max(-1, Math.min(1, pitch)),
      roll: Math.max(-1, Math.min(1, roll)),
      throttleDelta,
      brake,
    };
  }
}
