// Seeded randomness, so the island, the rings and every screenshot are the
// same on every load with the same seed. mulberry32 plus value noise.

// A small fast seeded PRNG.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Smooth interpolation helper for value noise.
function smooth(t) {
  return t * t * (3 - 2 * t);
}

// 2D value noise on a fixed lattice, seeded. Deterministic for one seed.
export function makeNoise(seed) {
  const rand = mulberry32(seed);
  const size = 64;
  const lattice = new Float32Array((size + 1) * (size + 1));
  for (let i = 0; i < lattice.length; i++) lattice[i] = rand();
  function at(ix, iz) {
    const x = ((ix % size) + size) % size;
    const z = ((iz % size) + size) % size;
    return lattice[z * (size + 1) + x];
  }
  return function noise(x, z, cell) {
    const gx = x / cell;
    const gz = z / cell;
    const ix = Math.floor(gx);
    const iz = Math.floor(gz);
    const fx = smooth(gx - ix);
    const fz = smooth(gz - iz);
    const a = at(ix, iz);
    const b = at(ix + 1, iz);
    const c = at(ix, iz + 1);
    const d = at(ix + 1, iz + 1);
    return a + (b - a) * fx + (c - a) * fz + (a - b - c + d) * fx * fz;
  };
}
