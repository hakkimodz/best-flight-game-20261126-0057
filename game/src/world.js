// Merapi Ridge Run — the island. A seeded heightfield with one volcano, a
// beach ring, a town with a runway, a lighthouse, a reef and a bay, plus the
// rings and checkpoints the missions fly. Everything is deterministic for a
// seed, so screenshots and replays match.

import { CONFIG } from './config.js';
import { makeNoise, mulberry32 } from './random.js';

const VOLCANO = { x: 1150, z: -750, height: 880, radius: 1050 };
const TOWN = { x: -950, z: 950 };
const RUNWAY = { x: -950, z: 950, heading: 1.22, length: 620, width: 34 };
const LIGHTHOUSE = { x: 2350, z: 250 };
const REEF = { x: 2350, z: 1950 };
const BAY = { x: -2150, z: -1350 };

export const LANDMARKS = [
  { id: 'volcano', name: 'Puncak Merapi', x: VOLCANO.x, z: VOLCANO.z, y: 1050 },
  { id: 'lighthouse', name: 'Mercusuar Tanjung', x: LIGHTHOUSE.x, z: LIGHTHOUSE.z, y: 170 },
  { id: 'town', name: 'Kota Pelabuhan', x: TOWN.x, z: TOWN.z, y: 90 },
  { id: 'bay', name: 'Teluk Air Terjun', x: BAY.x, z: BAY.z, y: 160 },
  { id: 'reef', name: 'Karang Biru', x: REEF.x, z: REEF.z, y: 60 },
];

export { RUNWAY, VOLCANO, TOWN, LIGHTHOUSE, REEF, BAY };

function smoothstep(a, b, t) {
  const x = Math.min(1, Math.max(0, (t - a) / (b - a)));
  return x * x * (3 - 2 * x);
}

export class World {
  constructor(seed = 1) {
    this.seed = seed;
    const noise = makeNoise(seed);
    const rand = mulberry32(seed * 7919 + 13);
    const cells = CONFIG.gridCells;
    const half = CONFIG.worldHalf;
    const step = (half * 2) / cells;
    this.step = step;
    this.cells = cells;
    // Height samples on a (cells+1) x (cells+1) lattice.
    this.heights = new Float32Array((cells + 1) * (cells + 1));
    for (let iz = 0; iz <= cells; iz++) {
      for (let ix = 0; ix <= cells; ix++) {
        const x = -half + ix * step;
        const z = -half + iz * step;
        this.heights[iz * (cells + 1) + ix] = this.rawHeight(x, z, noise);
      }
    }
    // Deterministic scatter: trees on the lowlands, houses in the town.
    this.trees = [];
    for (let i = 0; i < 260; i++) {
      const x = (rand() * 2 - 1) * 2600;
      const z = (rand() * 2 - 1) * 2600;
      const h = this.heightAt(x, z);
      if (h > 6 && h < 260) this.trees.push({ x, z, h, s: 7 + rand() * 9 });
    }
    this.houses = [];
    for (let i = 0; i < 42; i++) {
      const a = rand() * Math.PI * 2;
      const r = 90 + rand() * 260;
      const x = TOWN.x + Math.cos(a) * r;
      const z = TOWN.z + Math.sin(a) * r * 0.7;
      this.houses.push({ x, z, h: this.heightAt(x, z), w: 12 + rand() * 14, d: 10 + rand() * 10, ht: 8 + rand() * 10 });
    }
    // Clouds drift slowly; positions are seeded too.
    this.clouds = [];
    for (let i = 0; i < 16; i++) {
      this.clouds.push({
        x: (rand() * 2 - 1) * 2800,
        z: (rand() * 2 - 1) * 2800,
        y: 320 + rand() * 260,
        s: 90 + rand() * 160,
      });
    }
    this.rings = this.buildRings();
  }

  rawHeight(x, z, noise) {
    const d = Math.hypot(x, z);
    // Island falloff: high in the middle, beach at the rim, sea beyond.
    const falloff = 1 - smoothstep(1900, 2950, d);
    let h = noise(x, z, 520) * 260 + noise(x + 900, z - 400, 190) * 120;
    h *= falloff;
    // The volcano cone dominates the north-east.
    const dv = Math.hypot(x - VOLCANO.x, z - VOLCANO.z);
    const cone = Math.max(0, 1 - dv / VOLCANO.radius);
    h += cone * cone * VOLCANO.height;
    // Crater dip at the very top.
    h -= Math.max(0, 1 - dv / 130) * 120;
    // Flatten the town and the runway strip so landings read.
    const dt = Math.hypot(x - TOWN.x, z - TOWN.z);
    h = h * smoothstep(120, 420, dt) + 9 * (1 - smoothstep(120, 420, dt));
    // Beach ring just above the water.
    if (h < 3 && d < 2950) h = 3;
    if (d >= 2950) h = -6;
    return h;
  }

  heightAt(x, z) {
    const half = CONFIG.worldHalf;
    const cells = this.cells;
    const gx = ((x + half) / (half * 2)) * cells;
    const gz = ((z + half) / (half * 2)) * cells;
    const ix = Math.max(0, Math.min(cells - 1, Math.floor(gx)));
    const iz = Math.max(0, Math.min(cells - 1, Math.floor(gz)));
    const fx = gx - ix;
    const fz = gz - iz;
    const at = (a, b) => this.heights[b * (cells + 1) + a];
    const h00 = at(ix, iz);
    const h10 = at(ix + 1, iz);
    const h01 = at(ix, iz + 1);
    const h11 = at(ix + 1, iz + 1);
    return h00 + (h10 - h00) * fx + (h01 - h00) * fz + (h00 - h10 - h01 + h11) * fx * fz;
  }

  // The runway rectangle, for landing checks and drawing.
  runwayCorners() {
    const { x, z, heading, length, width } = RUNWAY;
    const fx = Math.sin(heading);
    const fz = Math.cos(heading);
    const rx = Math.cos(heading);
    const rz = -Math.sin(heading);
    const hl = length / 2;
    const hw = width / 2;
    return [
      { x: x - fx * hl - rx * hw, z: z - fz * hl - rz * hw },
      { x: x + fx * hl - rx * hw, z: z + fz * hl - rz * hw },
      { x: x + fx * hl + rx * hw, z: z + fz * hl + rz * hw },
      { x: x - fx * hl + rx * hw, z: z - fz * hl + rz * hw },
    ];
  }

  onRunway(x, z) {
    const { x: cx, z: cz, heading, length, width } = RUNWAY;
    const dx = x - cx;
    const dz = z - cz;
    const along = dx * Math.sin(heading) + dz * Math.cos(heading);
    const across = dx * Math.cos(heading) - dz * Math.sin(heading);
    return Math.abs(along) < length / 2 && Math.abs(across) < width / 2;
  }

  buildRings() {
    // Ring Run: 8 rings on a tour of the island, altitudes 160-520 m.
    const stops = [
      { x: -950, z: 300, y: 200 },
      { x: -1600, z: -700, y: 300 },
      { x: -600, z: -1600, y: 340 },
      { x: 1150, z: -750, y: 1020 },
      { x: 2100, z: -200, y: 420 },
      { x: 2350, z: 250, y: 220 },
      { x: 1750, z: 1750, y: 200 },
      { x: 200, z: 1400, y: 240 },
    ];
    const rings = [];
    for (let i = 0; i < stops.length; i++) {
      const a = stops[i];
      const b = stops[(i + 1) % stops.length];
      // Each ring faces the next one, so the pilot flies through it.
      const dx = b.x - a.x;
      const dz = b.z - a.z;
      const len = Math.hypot(dx, dz) || 1;
      rings.push({ x: a.x, y: a.y, z: a.z, nx: dx / len, nz: dz / len, r: CONFIG.ringRadius });
    }
    return rings;
  }

  // The three rings of the landing circuit: after take-off heading 1.22
  // (east, along the runway), ring 1 lies ahead downwind, ring 2 turns the
  // crosswind leg north, ring 3 turns base, then final back to the runway.
  // Each ring faces the direction the pilot flies through it.
  circuitRings() {
    return [
      { x: -300, y: 320, z: 1200, nx: 0.93, nz: 0.35, r: CONFIG.ringRadius },
      { x: 400, y: 380, z: 500, nx: 0.7, nz: -0.7, r: CONFIG.ringRadius },
      { x: -400, y: 220, z: 200, nx: -0.94, nz: -0.35, r: CONFIG.ringRadius },
    ];
  }
}
