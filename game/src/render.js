// Merapi Ridge Run — the renderer. A small software 3D engine on a 2D
// canvas: sky and sea, a projected heightfield island, landmarks, glowing
// rings, and a low-poly aircraft drawn in front of a chase camera. No
// library, no network, no image assets — every pixel is computed here.

import { CONFIG } from './config.js';
import { LANDMARKS, RUNWAY, VOLCANO } from './world.js';

const SUN = norm([0.55, 0.5, 0.65]); // fixed dawn sun direction

function norm(v) {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
}

function dot(a, b) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function cross(a, b) {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

function sub(a, b) {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

// Mix two colours, each #rrggbb or rgb(r,g,b).
function parseColor(str) {
  if (str[0] === '#') {
    const p = parseInt(str.slice(1), 16);
    return [(p >> 16) & 255, (p >> 8) & 255, p & 255];
  }
  const m = str.match(/(\d+)[,\s]+(\d+)[,\s]+(\d+)/);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : [0, 0, 0];
}

function mix(hexA, hexB, t) {
  const a = parseColor(hexA);
  const b = parseColor(hexB);
  const r = Math.round(a[0] + (b[0] - a[0]) * t);
  const g = Math.round(a[1] + (b[1] - a[1]) * t);
  const b2 = Math.round(a[2] + (b[2] - a[2]) * t);
  return `rgb(${r},${g},${b2})`;
}

function shade(hex, f) {
  const p = parseColor(hex);
  const r = Math.min(255, Math.round(p[0] * f));
  const g = Math.min(255, Math.round(p[1] * f));
  const b = Math.min(255, Math.round(p[2] * f));
  return `rgb(${r},${g},${b})`;
}

// Terrain colour by height, with a deterministic speckle per cell.
function terrainColour(h, slope, hash) {
  let base;
  if (h < 4) base = '#d9c27a'; // beach sand
  else if (h < 70) base = '#5d9140'; // lowland grass
  else if (h < 220) base = '#3f7034'; // forest
  else if (h < 480) base = '#7d7468'; // rock
  else if (h < 700) base = '#8d8172'; // high rock
  else base = '#e9eef2'; // snow on the summit
  if (slope > 0.55 && h > 60) base = '#6e6258'; // steep faces are bare rock
  const f = 0.92 + hash * 0.16;
  return shade(base, f);
}

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.w = 0;
    this.h = 0;
  }

  resize(w, h) {
    this.w = w;
    this.h = h;
    this.canvas.width = w;
    this.canvas.height = h;
  }

  camera(aircraft) {
    const h = aircraft.heading;
    const fx = Math.sin(h);
    const fz = Math.cos(h);
    const pos = [aircraft.x - fx * CONFIG.camDistance, aircraft.y + CONFIG.camHeight, aircraft.z - fz * CONFIG.camDistance];
    const look = [aircraft.x + fx * 60, aircraft.y + 1.5, aircraft.z + fz * 60];
    const fwd = norm(sub(look, pos));
    const right = norm(cross([0, 1, 0], fwd));
    const up = cross(fwd, right);
    const f = (this.h / 2) / Math.tan(((CONFIG.fov / 2) * Math.PI) / 180);
    return { pos, fwd, right, up, f };
  }

  project(cam, p) {
    const d = sub(p, cam.pos);
    const cz = dot(d, cam.fwd);
    if (cz < 2) return null;
    const cx = dot(d, cam.right);
    const cy = dot(d, cam.up);
    return {
      x: this.w / 2 + (cx * cam.f) / cz,
      y: this.h / 2 - (cy * cam.f) / cz,
      dist: cz,
    };
  }

  draw(state) {
    const { ctx, w, h } = this;
    const { world, aircraft, mission, time } = state;
    const cam = this.camera(aircraft);
    this.cam = cam;

    // Sky.
    const sky = ctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, CONFIG.skyTop);
    sky.addColorStop(0.55, CONFIG.skyMid);
    sky.addColorStop(0.78, CONFIG.skyHorizon);
    sky.addColorStop(1, CONFIG.skyHorizon);
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);

    // Sun with a soft glow.
    const sunPoint = this.project(cam, [cam.pos[0] + SUN[0] * 4000, cam.pos[1] + SUN[1] * 4000, cam.pos[2] + SUN[2] * 4000]);
    if (sunPoint) {
      const g = ctx.createRadialGradient(sunPoint.x, sunPoint.y, 4, sunPoint.x, sunPoint.y, 130);
      g.addColorStop(0, 'rgba(255,244,200,0.95)');
      g.addColorStop(0.25, 'rgba(255,220,140,0.55)');
      g.addColorStop(1, 'rgba(255,220,140,0)');
      ctx.fillStyle = g;
      ctx.fillRect(sunPoint.x - 140, sunPoint.y - 140, 280, 280);
      ctx.fillStyle = '#fff6cf';
      ctx.beginPath();
      ctx.arc(sunPoint.x, sunPoint.y, 26, 0, Math.PI * 2);
      ctx.fill();
    }

    // Sea: everything below the horizon that no land covers.
    const horizon = this.project(cam, [cam.pos[0] + cam.fwd[0] * 5000, cam.pos[1], cam.pos[2] + cam.fwd[2] * 5000]);
    const horizonY = horizon ? horizon.y : h * 0.55;
    if (horizonY < h) {
      const sea = ctx.createLinearGradient(0, horizonY, 0, h);
      sea.addColorStop(0, CONFIG.seaShallow);
      sea.addColorStop(1, CONFIG.seaDeep);
      ctx.fillStyle = sea;
      ctx.fillRect(0, Math.max(0, horizonY), w, h - Math.max(0, horizonY));
      // Sun glitter on the water.
      if (sunPoint && sunPoint.y > horizonY - 40) {
        ctx.fillStyle = 'rgba(255,240,190,0.25)';
        ctx.fillRect(sunPoint.x - 60, horizonY, 120, h - horizonY);
      }
    }

    this.drawClouds(world, cam, time);
    this.drawTerrain(world, cam);
    this.drawTrees(world, cam);
    this.drawHouses(world, cam);
    this.drawLighthouse(world, cam);
    this.drawRunway(world, cam);
    this.drawTargets(world, mission, cam, time);
    this.drawSmoke(world, cam, time);
    this.drawAircraft(aircraft, cam);
  }

  drawClouds(world, cam, time) {
    const { ctx } = this;
    for (const c of world.clouds) {
      const x = c.x + time * 2;
      const p = this.project(cam, [x, c.y, c.z]);
      if (!p || p.x < -300 || p.x > this.w + 300) continue;
      const s = (c.s * cam.f) / p.dist;
      if (s < 4) continue;
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      for (let i = -1; i <= 1; i++) {
        ctx.beginPath();
        ctx.ellipse(p.x + i * s * 0.55, p.y + (i === 0 ? -s * 0.12 : s * 0.08), s * 0.62, s * 0.3, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  drawTerrain(world, cam) {
    const { ctx } = this;
    const cells = world.cells;
    const half = CONFIG.worldHalf;
    const step = world.step;
    const quads = [];
    for (let iz = 0; iz < cells; iz++) {
      for (let ix = 0; ix < cells; ix++) {
        const x0 = -half + ix * step;
        const z0 = -half + iz * step;
        const cx = x0 + step / 2;
        const cz = z0 + step / 2;
        const dx = cx - cam.pos[0];
        const dz = cz - cam.pos[2];
        const dist = Math.hypot(dx, dz);
        if (dist > 5200) continue;
        // Behind the camera?
        const along = dx * cam.fwd[0] + dz * cam.fwd[2];
        if (along < -300) continue;
        const across = Math.abs(dx * cam.right[0] + dz * cam.right[2]);
        if (across > along * 1.6 + 600) continue;
        const h00 = world.heights[iz * (cells + 1) + ix];
        const h10 = world.heights[iz * (cells + 1) + ix + 1];
        const h01 = world.heights[(iz + 1) * (cells + 1) + ix];
        const h11 = world.heights[(iz + 1) * (cells + 1) + ix + 1];
        const hash = ((ix * 73 + iz * 131) % 97) / 97;
        quads.push({ ix, iz, x0, z0, dist, h00, h10, h01, h11, hash });
      }
    }
    quads.sort((a, b) => b.dist - a.dist);
    for (const q of quads) {
      const p00 = this.project(cam, [q.x0, q.h00, q.z0]);
      const p10 = this.project(cam, [q.x0 + step, q.h10, q.z0]);
      const p11 = this.project(cam, [q.x0 + step, q.h11, q.z0 + step]);
      const p01 = this.project(cam, [q.x0, q.h01, q.z0 + step]);
      if (!p00 || !p10 || !p11 || !p01) continue;
      const hAvg = (q.h00 + q.h10 + q.h01 + q.h11) / 4;
      const slope = Math.max(Math.abs(q.h10 - q.h00), Math.abs(q.h01 - q.h00)) / step;
      let colour = terrainColour(hAvg, slope, q.hash);
      // Distance haze towards the horizon colour.
      const haze = Math.min(0.7, q.dist / 6500);
      colour = mix(colour, CONFIG.skyHorizon, haze * 0.8);
      ctx.fillStyle = colour;
      ctx.beginPath();
      ctx.moveTo(p00.x, p00.y);
      ctx.lineTo(p10.x, p10.y);
      ctx.lineTo(p11.x, p11.y);
      ctx.lineTo(p01.x, p01.y);
      ctx.closePath();
      ctx.fill();
    }
  }

  drawTrees(world, cam) {
    const { ctx } = this;
    for (const t of world.trees) {
      const d = Math.hypot(t.x - cam.pos[0], t.z - cam.pos[2]);
      if (d > 1400 || d < 30) continue;
      const base = this.project(cam, [t.x, t.h, t.z]);
      const top = this.project(cam, [t.x, t.h + t.s, t.z]);
      if (!base || !top) continue;
      const wdt = Math.max(1, ((t.s * 0.5 * cam.f) / d));
      ctx.fillStyle = '#2c5a26';
      ctx.beginPath();
      ctx.moveTo(top.x, top.y);
      ctx.lineTo(base.x - wdt, base.y);
      ctx.lineTo(base.x + wdt, base.y);
      ctx.closePath();
      ctx.fill();
    }
  }

  drawHouses(world, cam) {
    const { ctx } = this;
    for (const hs of world.houses) {
      const d = Math.hypot(hs.x - cam.pos[0], hs.z - cam.pos[2]);
      if (d > 1200 || d < 30) continue;
      const p = this.project(cam, [hs.x, hs.h, hs.z]);
      if (!p) continue;
      const wdt = Math.max(2, ((hs.w * cam.f) / d));
      const hgt = Math.max(2, ((hs.ht * cam.f) / d));
      ctx.fillStyle = '#e8e2d4';
      ctx.fillRect(p.x - wdt / 2, p.y - hgt, wdt, hgt);
      ctx.fillStyle = '#b3542e';
      ctx.beginPath();
      ctx.moveTo(p.x - wdt / 2, p.y - hgt);
      ctx.lineTo(p.x, p.y - hgt - hgt * 0.5);
      ctx.lineTo(p.x + wdt / 2, p.y - hgt);
      ctx.closePath();
      ctx.fill();
    }
  }

  drawLighthouse(world, cam) {
    const { ctx } = this;
    const x = 2350;
    const z = 250;
    const ground = world.heightAt(x, z);
    const d = Math.hypot(x - cam.pos[0], z - cam.pos[2]);
    if (d > 2000) return;
    const base = this.project(cam, [x, ground, z]);
    const top = this.project(cam, [x, ground + 42, z]);
    if (!base || !top) return;
    const wdt = Math.max(2, ((7 * cam.f) / d));
    ctx.fillStyle = '#f4f1e8';
    ctx.fillRect(base.x - wdt / 2, top.y, wdt, base.y - top.y);
    ctx.fillStyle = '#c0392b';
    ctx.fillRect(base.x - wdt / 2, top.y + (base.y - top.y) * 0.25, wdt, (base.y - top.y) * 0.18);
    ctx.fillStyle = '#222';
    ctx.fillRect(base.x - wdt / 2 - 1, top.y - 3, wdt + 2, 4);
  }

  drawRunway(world, cam) {
    const { ctx } = this;
    const corners = world.runwayCorners().map((c) => {
      const g = world.heightAt(c.x, c.z);
      return this.project(cam, [c.x, g + 0.8, c.z]);
    });
    if (corners.some((p) => !p)) return;
    ctx.fillStyle = '#3a3f45';
    ctx.beginPath();
    ctx.moveTo(corners[0].x, corners[0].y);
    for (let i = 1; i < 4; i++) ctx.lineTo(corners[i].x, corners[i].y);
    ctx.closePath();
    ctx.fill();
    // Centreline dashes.
    ctx.fillStyle = '#f5f5f5';
    const { x, z, heading, length } = RUNWAY;
    const fx = Math.sin(heading);
    const fz = Math.cos(heading);
    for (let d = -length / 2 + 30; d < length / 2 - 20; d += 60) {
      const a = this.project(cam, [x + fx * d - fx * 12, world.heightAt(x + fx * d, z + fz * d) + 1, z + fz * d - fz * 12]);
      const b = this.project(cam, [x + fx * d + fx * 12, world.heightAt(x + fx * d, z + fz * d) + 1, z + fz * d + fz * 12]);
      if (!a || !b) continue;
      ctx.strokeStyle = '#f5f5f5';
      ctx.lineWidth = Math.max(1, Math.abs(b.x - a.x) * 0.08 + 1);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
  }

  drawTargets(world, mission, cam, time) {
    const { ctx } = this;
    if (!mission) return;
    const targets = mission.targets || [];
    for (let i = 0; i < targets.length; i++) {
      const t = targets[i];
      if (t.kind === 'land') continue;
      const isNext = mission.currentTarget === t;
      const done = mission.id === 'rings' || mission.id === 'landing'
        ? i < mission.ringIndex
        : mission.visited.has(t.id);
      if (done) continue;
      const p = this.project(cam, [t.x, t.y, t.z]);
      if (!p) continue;
      const d = Math.hypot(t.x - cam.pos[0], t.y - cam.pos[1], t.z - cam.pos[2]);
      if (t.kind === 'ring') {
        const r = Math.max(4, ((t.r * cam.f) / Math.max(30, d)));
        // Light beam above the next ring so it is easy to find.
        if (isNext) {
          const top = this.project(cam, [t.x, t.y + 120, t.z]);
          if (top) {
            const beam = ctx.createLinearGradient(p.x, top.y, p.x, p.y);
            beam.addColorStop(0, 'rgba(255,200,60,0)');
            beam.addColorStop(1, 'rgba(255,200,60,0.5)');
            ctx.strokeStyle = beam;
            ctx.lineWidth = Math.max(2, r * 0.08);
            ctx.beginPath();
            ctx.moveTo(p.x, top.y);
            ctx.lineTo(p.x, p.y);
            ctx.stroke();
          }
        }
        ctx.save();
        if (isNext) {
          ctx.shadowColor = '#ffc83d';
          ctx.shadowBlur = 22;
        }
        ctx.strokeStyle = isNext ? '#ffc83d' : 'rgba(80,200,255,0.75)';
        ctx.lineWidth = Math.max(2, r * 0.14);
        ctx.beginPath();
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
        if (isNext) {
          ctx.fillStyle = '#ffc83d';
          ctx.font = `bold ${Math.max(12, r * 0.28)}px sans-serif`;
          ctx.textAlign = 'center';
          ctx.fillText(t.label, p.x, p.y - r - 10);
        }
      } else {
        // Checkpoint beacon: a diamond with a beam and a name.
        const top = this.project(cam, [t.x, t.y + 130, t.z]);
        if (top) {
          ctx.strokeStyle = 'rgba(255,200,60,0.6)';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(p.x, top.y);
          ctx.lineTo(p.x, p.y);
          ctx.stroke();
        }
        const s = Math.max(6, (30 * cam.f) / Math.max(40, d));
        ctx.fillStyle = isNext ? '#ffc83d' : 'rgba(80,200,255,0.8)';
        ctx.beginPath();
        ctx.moveTo(p.x, p.y - s);
        ctx.lineTo(p.x + s * 0.7, p.y);
        ctx.lineTo(p.x, p.y + s);
        ctx.lineTo(p.x - s * 0.7, p.y);
        ctx.closePath();
        ctx.fill();
        if (isNext) {
          ctx.fillStyle = '#fff';
          ctx.font = 'bold 14px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(t.label, p.x, p.y - s - 8);
        }
      }
    }
    // The landing target: a marker over the runway when it is time to land,
    // drawn above the aircraft so it never crosses the plane.
    if (mission.id === 'landing' && mission.ringIndex >= 3 && !mission.done) {
      const p = this.project(cam, [RUNWAY.x, 60, RUNWAY.z]);
      if (p) {
        ctx.fillStyle = '#ffc83d';
        ctx.font = 'bold 16px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('LAND HERE — RUNWAY 07', p.x, p.y - 70);
      }
    }
  }

  drawSmoke(world, cam, time) {
    const { ctx } = this;
    for (let i = 0; i < 6; i++) {
      const rise = ((time * 14 + i * 26) % 160);
      const p = this.project(cam, [VOLCANO.x + Math.sin(i * 2.3) * 14, 930 + rise, VOLCANO.z + Math.cos(i * 1.7) * 14]);
      if (!p) continue;
      const d = Math.hypot(VOLCANO.x - cam.pos[0], VOLCANO.z - cam.pos[2]);
      const s = Math.max(3, ((26 + rise * 0.35) * cam.f) / Math.max(60, d));
      ctx.fillStyle = `rgba(200,200,205,${0.35 - rise * 0.0012})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, s, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // The aircraft: a low-poly prop plane in the chase view, built from
  // triangles in local space (x right, y up, z forward), then rotated by
  // heading, pitch and bank and projected through the camera.
  drawAircraft(aircraft, cam) {
    const { ctx } = this;
    const h = aircraft.heading;
    const p = aircraft.pitch;
    const b = aircraft.bank;
    const fwd = [Math.sin(h) * Math.cos(p), Math.sin(p), Math.cos(h) * Math.cos(p)];
    const right0 = [Math.cos(h), 0, -Math.sin(h)];
    const up0 = cross(fwd, right0);
    const cb = Math.cos(b);
    const sb = Math.sin(b);
    const right = [right0[0] * cb - up0[0] * sb, right0[1] * cb - up0[1] * sb, right0[2] * cb - up0[2] * sb];
    const up = [right0[0] * sb + up0[0] * cb, right0[1] * sb + up0[1] * cb, right0[2] * sb + up0[2] * cb];
    const O = [aircraft.x, aircraft.y, aircraft.z];
    const toWorld = (v) => [
      O[0] + right[0] * v[0] + up[0] * v[1] + fwd[0] * v[2],
      O[1] + right[1] * v[0] + up[1] * v[1] + fwd[1] * v[2],
      O[2] + right[2] * v[0] + up[2] * v[1] + fwd[2] * v[2],
    ];
    // Fuselage cross-sections: z, half-width, top y, bottom y.
    const sections = [
      { z: 4.3, w: 0.02, t: 0.1, b: 0.1 },
      { z: 3.2, w: 0.42, t: 0.55, b: -0.45 },
      { z: 0.8, w: 0.58, t: 0.8, b: -0.55 },
      { z: -3.2, w: 0.4, t: 0.55, b: -0.35 },
      { z: -3.9, w: 0.02, t: 0.15, b: 0.05 },
    ];
    const tris = [];
    const V = (sx, sy, z) => [sx, sy, z];
    for (let i = 0; i < sections.length - 1; i++) {
      const a = sections[i];
      const c = sections[i + 1];
      // Top face, left face, right face, bottom face.
      tris.push({ v: [V(-a.w, a.t, a.z), V(a.w, a.t, a.z), V(c.w, c.t, c.z)], col: '#f2e6c9' });
      tris.push({ v: [V(-a.w, a.t, a.z), V(c.w, c.t, c.z), V(-c.w, c.t, c.z)], col: '#f2e6c9' });
      tris.push({ v: [V(-a.w, a.t, a.z), V(-c.w, c.t, c.z), V(-c.w, c.b, c.z)], col: '#e8641f' });
      tris.push({ v: [V(-a.w, a.t, a.z), V(-c.w, c.b, c.z), V(-a.w, a.b, a.z)], col: '#e8641f' });
      tris.push({ v: [V(a.w, a.t, a.z), V(a.w, a.b, a.z), V(c.w, c.b, c.z)], col: '#e8641f' });
      tris.push({ v: [V(a.w, a.t, a.z), V(c.w, c.b, c.z), V(c.w, c.t, c.z)], col: '#e8641f' });
      tris.push({ v: [V(-a.w, a.b, a.z), V(-c.w, c.b, c.z), V(c.w, c.b, c.z)], col: '#4a4640' });
      tris.push({ v: [V(-a.w, a.b, a.z), V(c.w, c.b, c.z), V(a.w, a.b, a.z)], col: '#4a4640' });
    }
    // Canopy.
    tris.push({ v: [V(-0.34, 0.8, 2.3), V(0.34, 0.8, 2.3), V(0.3, 0.95, 0.6)], col: '#1e3a4c' });
    tris.push({ v: [V(-0.34, 0.8, 2.3), V(0.3, 0.95, 0.6), V(-0.3, 0.95, 0.6)], col: '#1e3a4c' });
    // Main wings (slight dihedral), tailplane and fin.
    const wing = (z0, z1, span, y0, tipY, col) => {
      tris.push({ v: [V(-span, tipY, z0), V(span, tipY, z0), V(span, tipY, z1)], col });
      tris.push({ v: [V(-span, tipY, z0), V(span, tipY, z1), V(-span, tipY, z1)], col });
      tris.push({ v: [V(-span, y0, z0), V(-span, y0, z1), V(span, y0, z1)], col: '#d8cdb2' });
      tris.push({ v: [V(-span, y0, z0), V(span, y0, z1), V(span, y0, z0)], col: '#d8cdb2' });
    };
    wing(1.5, -0.3, 5.6, 0.05, 0.42, '#e8641f');
    wing(-2.9, -3.7, 2.3, 0.1, 0.3, '#f2e6c9');
    tris.push({ v: [V(0, 0.5, -2.9), V(0, 1.9, -3.5), V(0, 0.4, -3.8)], col: '#e8641f' });
    tris.push({ v: [V(0.06, 0.5, -2.9), V(0.06, 0.4, -3.8), V(0.06, 1.9, -3.5)], col: '#c94f14' });
    tris.push({ v: [V(-0.06, 0.5, -2.9), V(-0.06, 1.9, -3.5), V(-0.06, 0.4, -3.8)], col: '#c94f14' });

    // Project and depth-sort the triangles.
    const drawn = [];
    for (const t of tris) {
      const w0 = toWorld(t.v[0]);
      const w1 = toWorld(t.v[1]);
      const w2 = toWorld(t.v[2]);
      const p0 = this.project(cam, w0);
      const p1 = this.project(cam, w1);
      const p2 = this.project(cam, w2);
      if (!p0 || !p1 || !p2) continue;
      const n = norm(cross(sub(w1, w0), sub(w2, w0)));
      const light = 0.72 + 0.28 * Math.max(0, dot(n, SUN));
      drawn.push({ p0, p1, p2, col: shade(t.col, light), dist: (p0.dist + p1.dist + p2.dist) / 3 });
    }
    drawn.sort((a, b) => b.dist - a.dist);
    for (const t of drawn) {
      ctx.fillStyle = t.col;
      ctx.beginPath();
      ctx.moveTo(t.p0.x, t.p0.y);
      ctx.lineTo(t.p1.x, t.p1.y);
      ctx.lineTo(t.p2.x, t.p2.y);
      ctx.closePath();
      ctx.fill();
    }
    // Spinning propeller disc at the nose.
    const propC = this.project(cam, toWorld([0, 0.1, 4.45]));
    if (propC) {
      const r = Math.max(3, (1.15 * cam.f) / propC.dist);
      ctx.fillStyle = 'rgba(220,220,220,0.28)';
      ctx.beginPath();
      ctx.arc(propC.x, propC.y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(60,60,60,0.5)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(propC.x, propC.y, r, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
}
