// Merapi Ridge Run — the flight model. An arcade model with real trade-offs:
// throttle sets speed, speed makes lift, bank turns the nose, and below the
// stall speed the wing gives up. Nothing here is a placeholder: every number
// in config.js is used.

import { CONFIG } from './config.js';

export class Aircraft {
  constructor(world) {
    this.world = world;
    this.resetToRunway();
  }

  resetToRunway() {
    // Start at the southern threshold of the runway, aligned with it,
    // sitting on the ground ready to roll.
    this.x = -1213;
    this.z = 854;
    this.y = this.world.heightAt(this.x, this.z) + 1.5;
    this.heading = 1.22; // aligned with the runway, ready to roll
    this.pitch = 0;
    this.bank = 0;
    this.speed = 0;
    this.throttle = 0;
    this.fuel = CONFIG.fuelMax;
    this.damage = 0;
    this.verticalSpeed = 0;
    this.onGround = true;
    this.stalled = false;
    this.engineOut = false;
    this.landed = false;
    this.crashed = false;
    this.crashReason = '';
  }

  resetAirborne(x, y, z, heading, speed) {
    this.x = x;
    this.y = y;
    this.z = z;
    this.heading = heading;
    this.pitch = 0;
    this.bank = 0;
    this.speed = speed;
    this.throttle = 0.75;
    this.fuel = CONFIG.fuelMax;
    this.damage = 0;
    this.verticalSpeed = 0;
    this.onGround = false;
    this.stalled = false;
    this.engineOut = false;
    this.landed = false;
    this.crashed = false;
    this.crashReason = '';
  }

  // input: { pitch: -1..1 (pull up positive), roll: -1..1 (right positive),
  // throttleDelta: -1..1, brake: bool }. dt in seconds.
  update(dt, input) {
    if (this.crashed || this.landed) return;
    const C = CONFIG;

    // Throttle, with the engine dead when the tank is dry.
    this.engineOut = this.fuel <= 0;
    const throttle = this.engineOut ? 0 : this.throttle;
    this.throttle = Math.min(1, Math.max(0, this.throttle + input.throttleDelta * dt * 0.6));
    if (this.engineOut) this.throttle = 0;

    // Speed chases its throttle target; the brake and drag pull it back.
    const target = throttle * C.maxSpeed;
    const drag = input.brake ? C.drag * 3 : C.drag;
    this.speed += (target - this.speed) * Math.min(1, drag * dt);
    this.speed = Math.max(0, this.speed);

    // Attitude follows the stick, easing back towards level when released.
    const pitchTarget = input.pitch * C.maxPitch;
    const bankTarget = input.roll * C.maxBank;
    this.pitch += (pitchTarget - this.pitch) * Math.min(1, 3.2 * dt);
    this.bank += (bankTarget - this.bank) * Math.min(1, 3.6 * dt);

    // The stall: below minimum speed the nose drops and the wing stops
    // answering the stick.
    this.stalled = this.speed < C.minSpeed && !this.onGround;
    if (this.stalled) {
      this.pitch += (0 - this.pitch) * Math.min(1, 2 * dt) - 0.35 * dt;
    }

    // Bank turns the heading; the turn tightens with speed.
    const turnRate = this.bank * C.turnFactor * Math.min(1, this.speed / C.cruiseSpeed);
    this.heading += turnRate * dt;

    // Climb from pitch and speed, sink from gravity when slow or idling.
    const climb = Math.sin(this.pitch) * this.speed;
    const sink = this.speed < C.minSpeed ? C.gravitySink * (1 - this.speed / C.minSpeed) : 0;
    const idleSink = (1 - throttle) * 1.6;
    this.verticalSpeed = climb - sink - idleSink;
    this.y += this.verticalSpeed * dt;

    // Move along the heading.
    const fx = Math.sin(this.heading);
    const fz = Math.cos(this.heading);
    this.x += fx * Math.cos(this.pitch) * this.speed * dt;
    this.z += fz * Math.cos(this.pitch) * this.speed * dt;

    // Fuel burns with the throttle.
    this.fuel = Math.max(0, this.fuel - (C.fuelBurnBase + C.fuelBurnThrottle * throttle) * dt);

    // Ground contact. The aircraft starts on the ground and rolls until it
    // has the speed and the nose-up to lift off; a touchdown only counts as
    // a landing when it comes down gently, on the runway, after flying.
    const ground = this.world.heightAt(this.x, this.z);
    const overRunway = this.world.onRunway(this.x, this.z);
    const clearance = this.y - ground;
    if (this.onGround) {
      this.y = ground + 1.5;
      this.verticalSpeed = 0;
      this.pitch = 0;
      this.bank = 0;
      if (this.speed > 32 && input.pitch > 0.2) this.onGround = false;
    } else if (clearance <= 1.5) {
      if (overRunway && Math.abs(this.verticalSpeed) < C.crashSinkRate && this.speed < C.maxLandingSpeed && Math.abs(this.bank) < 0.35) {
        // A real landing: wheels down, gentle, on the strip.
        this.y = ground + 1.5;
        this.verticalSpeed = 0;
        this.pitch = 0;
        this.bank = 0;
        this.onGround = true;
        this.landed = true;
      } else {
        // Terrain, sea or a hard arrival: the flight is over.
        this.crashed = true;
        this.crashReason = ground <= 0.5 ? 'Ditched in the sea' : 'Crashed into the terrain';
        if (Math.abs(this.verticalSpeed) > C.crashSinkRate) this.crashReason = 'Hit the ground too hard';
        this.y = ground + 1.5;
      }
    }

    // Leaving the island: turn the pilot back with a warning, not a wall.
    const d = Math.hypot(this.x, this.z);
    if (d > 3400) {
      const back = Math.atan2(-this.x, -this.z);
      let diff = back - this.heading;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      this.heading += diff * dt * 0.5;
    }
  }

  addFuel(n) {
    this.fuel = Math.min(CONFIG.fuelMax, this.fuel + n);
  }

  get altitude() {
    return Math.max(0, this.y - this.world.heightAt(this.x, this.z));
  }

  get speedKnots() {
    return Math.round(this.speed * 1.944);
  }

  get altitudeFeet() {
    return Math.round(this.y * 3.281);
  }

  get headingDegrees() {
    return Math.round(((this.heading * 180) / Math.PI % 360) + 360) % 360;
  }
}
