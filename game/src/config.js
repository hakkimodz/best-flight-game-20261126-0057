// Merapi Ridge Run — tuning and constants, one place for every number the
// flight model, the world and the HUD share.
export const CONFIG = {
  gameName: 'Merapi Ridge Run',
  // World: metres. The island is a volcanic island with a town, a runway, a
  // lighthouse and a reef, all placed by world.js from a fixed seed.
  worldHalf: 3000, // terrain spans -3000..3000 on x and z
  gridCells: 64, // terrain mesh cells per side (65 x 65 height samples)
  seaLevel: 0,
  // Flight model.
  maxSpeed: 92, // m/s at full throttle, level flight
  minSpeed: 26, // below this the wing stalls
  cruiseSpeed: 55,
  climbRate: 9, // extra m/s the engine can sustain in a climb
  pitchRate: 0.85, // rad/s at full elevator
  bankRate: 1.5, // rad/s at full aileron
  maxBank: 1.15, // rad
  maxPitch: 0.55, // rad
  turnFactor: 0.42, // heading rate per radian of bank
  drag: 0.35, // 1/s pull of speed towards its throttle target
  gravitySink: 6.5, // m/s sink with the engine at idle
  // Fuel and damage. The tank is sized so a good flight finishes a mission
  // with fuel to spare, while a wasteful one runs dry: fuel is a decision,
  // not a wall.
  fuelMax: 160,
  fuelBurnBase: 0.1, // units/s
  fuelBurnThrottle: 0.55, // units/s at full throttle
  fuelPerRing: 12,
  fuelPerCheckpoint: 12,
  crashSinkRate: 9, // m/s vertical speed that breaks the landing gear
  maxLandingSpeed: 46, // m/s above this a runway touchdown is a crash
  // Rings and checkpoints.
  ringRadius: 34,
  checkpointRadius: 90,
  // Camera.
  camDistance: 40, // metres behind the aircraft
  camHeight: 11, // metres above the aircraft
  fov: 70, // degrees, vertical
  // Scoring.
  ringPoints: 250,
  checkpointPoints: 300,
  landingPoints: 500,
  timeBonusPerSecond: 4,
  // Colours of the one visual style: dawn sky, teal sea, green island.
  skyTop: '#2f6fb4',
  skyMid: '#7fb2dd',
  skyHorizon: '#f6d9a8',
  seaDeep: '#14557e',
  seaShallow: '#2f8fb0',
};

// Mission roster. Three missions, three different goals: rings against the
// clock, a tour of the island's landmarks, and a take-off, circuit and
// landing on the runway.
export const MISSIONS = [
  {
    id: 'rings',
    name: 'Ring Run',
    blurb: 'Fly through all 8 sky rings in order before your fuel runs out.',
    goal: 'rings',
  },
  {
    id: 'tour',
    name: 'Island Tour',
    blurb: 'Visit all 5 landmarks: volcano, lighthouse, town, waterfall bay and reef.',
    goal: 'tour',
  },
  {
    id: 'landing',
    name: 'Island Hopper',
    blurb: 'Take off from the runway, fly the 3-ring circuit, then land back on it.',
    goal: 'landing',
  },
];
