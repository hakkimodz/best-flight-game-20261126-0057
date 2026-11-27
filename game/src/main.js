// Merapi Ridge Run — the game itself. Boots the world, the aircraft, the
// mission and the renderer, runs the loop, and owns the phase machine:
// title → flying → paused → over. Also the public surface the page and the
// screenshot harness use: window.__game.

import { CONFIG, MISSIONS } from './config.js';
import { World } from './world.js';
import { Aircraft } from './physics.js';
import { Mission } from './missions.js';
import { Renderer } from './render.js';
import { Hud } from './hud.js';
import { Input } from './input.js';
import { Sound } from './audio.js';
import { parseShot, applyShot } from './shots.js';

const BEST_KEY = 'merapi-ridge-run-best';

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new Renderer(canvas);
    this.hud = new Hud();
    this.sound = new Sound();
    const { seed, shot } = parseShot();
    this.seed = seed;
    this.world = new World(seed);
    this.aircraft = new Aircraft(this.world);
    this.mission = new Mission('rings', this.world);
    this.phase = 'title';
    this.selectedMission = 0;
    this.now = 0;
    this.best = 0;
    try {
      this.best = Number(localStorage.getItem(BEST_KEY) || 0) || 0;
    } catch {
      // A data: URL or a hosted page may refuse storage; the game plays on.
    }
    this.shotMode = shot;
    this.input = new Input(canvas, {
      onAction: (a) => this.handleAction(a),
      onClick: (x, y) => this.handleClick(x, y),
    });
    this.resize();
    window.addEventListener('resize', () => this.resize());
    applyShot(shot, this);
    if (shot) this.frozen = true;
    // In shot mode the frame is frozen after one render so the screenshot
    // is deterministic; normal play runs the loop.
    if (shot) {
      this.renderOnce();
    } else {
      this.last = performance.now();
      const loop = (t) => {
        requestAnimationFrame(loop);
        const dt = Math.min(0.05, (t - this.last) / 1000);
        this.last = t;
        this.tick(dt);
      };
      requestAnimationFrame(loop);
    }
    window.__game = this;
  }

  // Pose a deterministic screenshot state and freeze the simulation there,
  // so the frame the screenshot takes is the frame that was posed.
  poseShot(name) {
    applyShot(name, this);
    this.frozen = true;
    this.renderOnce();
  }

  resize() {
    this.renderer.resize(window.innerWidth, window.innerHeight);
  }

  startMission(id) {
    this.mission = new Mission(id, this.world);
    this.aircraft.resetToRunway();
    this.phase = 'flying';
    this.sound.ensure();
    this.sound.click();
  }

  handleAction(action) {
    if (!action) return;
    this.sound.ensure();
    if (action === 'mute') {
      const muted = this.sound.toggleMute();
      this.mission.say(muted ? 'Sound off' : 'Sound on', this.now);
      return;
    }
    if (action === 'restart') {
      this.startMission(this.mission.id);
      return;
    }
    if (action === 'pause') {
      if (this.phase === 'flying') this.phase = 'paused';
      else if (this.phase === 'paused') this.phase = 'flying';
      return;
    }
    if (action.startsWith('mission-')) {
      const i = Number(action.slice(8));
      if (this.phase === 'title' || this.phase === 'over') {
        this.selectedMission = i;
        this.sound.click();
      }
      return;
    }
    if (action === 'start') {
      if (this.phase === 'title' || this.phase === 'over') {
        this.startMission(MISSIONS[this.selectedMission].id);
      }
    }
  }

  handleClick(x, y) {
    this.sound.ensure();
    if (this.phase !== 'title') return;
    const w = window.innerWidth;
    const cardW = 300;
    const gap = 24;
    const totalW = MISSIONS.length * cardW + (MISSIONS.length - 1) * gap;
    let cx = (w - totalW) / 2;
    const cy = 230;
    for (let i = 0; i < MISSIONS.length; i++) {
      if (x >= cx && x <= cx + cardW && y >= cy && y <= cy + 150) {
        this.selectedMission = i;
        this.sound.click();
        return;
      }
      cx += cardW + gap;
    }
  }

  tick(dt) {
    this.now += dt;
    if (this.frozen) {
      this.renderOnce();
      return;
    }
    if (this.phase === 'flying') {
      const input = this.input.read(dt);
      const wasRing = this.mission.ringIndex;
      const wasVisited = this.mission.visited.size;
      this.aircraft.update(dt, input);
      this.mission.update(dt, this.aircraft, this.now);
      if (this.mission.ringIndex > wasRing) this.sound.ring();
      if (this.mission.visited.size > wasVisited) this.sound.checkpoint();
      if (this.aircraft.crashed) {
        this.sound.crash();
        this.endMission();
      } else if (this.mission.done && this.mission.won) {
        this.sound.win();
        this.endMission();
      } else if (this.mission.done) {
        this.endMission();
      }
      this.sound.setEngine(this.aircraft.throttle, this.aircraft.speed, true);
    } else {
      this.sound.setEngine(0, 0, false);
    }
    this.renderOnce();
  }

  endMission() {
    this.phase = 'over';
    if (this.mission.score > this.best) {
      this.best = this.mission.score;
      try {
        localStorage.setItem(BEST_KEY, String(this.best));
      } catch {
        // Private browsing or a hosted page may refuse storage; the score
        // on screen is what matters.
      }
    }
  }

  renderOnce() {
    const state = {
      world: this.world,
      aircraft: this.aircraft,
      mission: this.mission,
      phase: this.phase,
      now: this.now,
      selectedMission: this.selectedMission,
      best: this.best,
      time: this.now,
    };
    this.renderer.draw(state);
    this.hud.draw(this.renderer.ctx, this.renderer.w, this.renderer.h, state);
    document.getElementById('status').textContent =
      `${CONFIG.gameName}: ${this.mission.def.name}, ${this.mission.progressText}, ` +
      `score ${this.mission.score}, ${this.phase}`;
  }
}
