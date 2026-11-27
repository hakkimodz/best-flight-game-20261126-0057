// Merapi Ridge Run — missions. One mission at a time, each with a different
// goal: rings in order, a tour of landmarks, or a take-off, circuit and
// landing. Scores, fuel bonuses and win/lose all live here.

import { CONFIG, MISSIONS } from './config.js';
import { LANDMARKS } from './world.js';

export class Mission {
  constructor(id, world) {
    this.world = world;
    this.def = MISSIONS.find((m) => m.id === id) || MISSIONS[0];
    this.id = this.def.id;
    this.score = 0;
    this.time = 0;
    this.done = false;
    this.won = false;
    this.message = '';
    this.messageUntil = 0;
    this.ringIndex = 0;
    this.prevRingSide = 0;
    this.visited = new Set();
    this.tookOff = false;
    this.landedOk = false;
    this.targets = this.buildTargets();
  }

  buildTargets() {
    if (this.id === 'rings') {
      return this.world.rings.map((r, i) => ({ ...r, kind: 'ring', label: `Ring ${i + 1}` }));
    }
    if (this.id === 'tour') {
      return LANDMARKS.map((l) => ({ x: l.x, y: l.y, z: l.z, kind: 'checkpoint', label: l.name, id: l.id }));
    }
    // landing: three circuit rings, then the runway itself.
    return [
      ...this.world.circuitRings().map((r, i) => ({ ...r, kind: 'ring', label: `Circuit ${i + 1}` })),
      { kind: 'land', label: 'Land on the runway' },
    ];
  }

  get currentTarget() {
    if (this.id === 'rings' || this.id === 'landing') {
      return this.targets[this.ringIndex] || null;
    }
    return this.targets.find((t) => !this.visited.has(t.id)) || null;
  }

  get progressText() {
    if (this.id === 'rings') return `Ring ${Math.min(this.ringIndex + 1, 8)}/8`;
    if (this.id === 'tour') return `${this.visited.size}/5 landmarks`;
    if (this.id === 'landing') {
      if (!this.tookOff) return 'Take off!';
      if (this.ringIndex < 3) return `Circuit ${this.ringIndex + 1}/3`;
      return 'Land on the runway';
    }
    return '';
  }

  say(text, now, seconds = 2.5) {
    this.message = text;
    this.messageUntil = now + seconds;
  }

  update(dt, aircraft, now) {
    if (this.done) return;
    this.time += dt;
    const target = this.currentTarget;

    if (this.id === 'landing' && !this.tookOff && !aircraft.onGround) {
      this.tookOff = true;
      this.say('Take-off! Fly the circuit.', now);
    }

    if (target && target.kind === 'ring') {
      // Fly-through: the aircraft crosses the ring's plane inside its radius.
      const dx = aircraft.x - target.x;
      const dy = aircraft.y - target.y;
      const dz = aircraft.z - target.z;
      const side = dx * target.nx + dz * target.nz;
      const dist = Math.hypot(dx, dy, dz);
      if (this.prevRingSide !== 0 && Math.sign(side) !== Math.sign(this.prevRingSide) && dist < target.r) {
        this.score += CONFIG.ringPoints;
        aircraft.addFuel(CONFIG.fuelPerRing);
        this.ringIndex++;
        this.say(`${target.label} cleared! +${CONFIG.ringPoints}`, now);
        if (this.id === 'landing' && this.ringIndex === 3) {
          this.say('Circuit done — land on the runway!', now, 3);
        }
      }
      this.prevRingSide = side;
    }

    if (target && target.kind === 'checkpoint') {
      const d = Math.hypot(aircraft.x - target.x, aircraft.y - target.y, aircraft.z - target.z);
      if (d < CONFIG.checkpointRadius) {
        this.visited.add(target.id);
        this.score += CONFIG.checkpointPoints;
        aircraft.addFuel(CONFIG.fuelPerCheckpoint);
        this.say(`${target.label} visited! +${CONFIG.checkpointPoints}`, now);
      }
    }

    if (this.id === 'landing' && this.ringIndex >= 3 && aircraft.landed) {
      this.landedOk = true;
      const timeBonus = Math.max(0, Math.round(600 - this.time) * CONFIG.timeBonusPerSecond);
      this.score += CONFIG.landingPoints + timeBonus;
      this.done = true;
      this.won = true;
      this.say(`Landed! +${CONFIG.landingPoints} (+${timeBonus} time bonus)`, now, 4);
    }

    if (this.id === 'rings' && this.ringIndex >= this.world.rings.length) {
      const timeBonus = Math.max(0, Math.round(420 - this.time) * CONFIG.timeBonusPerSecond);
      this.score += timeBonus;
      this.done = true;
      this.won = true;
      this.say(`All rings cleared! Time bonus +${timeBonus}`, now, 4);
    }

    if (this.id === 'tour' && this.visited.size >= LANDMARKS.length) {
      const timeBonus = Math.max(0, Math.round(600 - this.time) * CONFIG.timeBonusPerSecond);
      this.score += timeBonus;
      this.done = true;
      this.won = true;
      this.say(`Tour complete! Time bonus +${timeBonus}`, now, 4);
    }

    if (aircraft.crashed) {
      this.done = true;
      this.won = false;
    }
    if (aircraft.fuel <= 0 && aircraft.onGround && aircraft.speed < 2 && !this.done) {
      this.done = true;
      this.won = false;
    }
  }

  resultText(aircraft) {
    if (this.won) return 'Mission complete!';
    if (aircraft.crashed) return aircraft.crashReason || 'Crashed';
    return 'Out of fuel on the ground';
  }
}
