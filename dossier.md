# Merapi Ridge Run — dossier

## The game

A complete, original 3D flight game that runs in a desktop browser from
static files, with no network request and no library. You fly a small prop
plane — the Merapi Air island hopper — in chase view over a volcanic island
at dawn: a smoking volcano, a beach ring, a port town with a runway, a
lighthouse, a waterfall bay and a coral reef, all generated from a fixed
seed so every flight sees the same island.

The aircraft is a low-poly model built from triangles in the game's own
code (fuselage, wings, tailplane, fin, canopy, spinning propeller), lit by
a fixed dawn sun. The terrain is a projected heightfield mesh with
height-based colours (sand, grass, forest, rock, snow), distance haze,
scattered trees, town houses, a lighthouse and a striped runway. Clouds
drift, the volcano smokes, and the sea glitters under the sun.

## Controls

- **Arrow keys / W A S D** — pitch and bank (bank turns the nose)
- **Shift / Ctrl** — throttle up / down; **mouse wheel** — throttle
- **Mouse** — move to steer; the pointer steers gently and fades out
- **Space** — airbrake
- **1 / 2 / 3** — pick a mission on the title screen (or click a card)
- **Enter** — start / fly again; **P** — pause; **R** — restart; **M** — sound

## Missions (three different goals)

1. **Ring Run** — fly through all 8 sky rings in order before the fuel
   runs out. Each ring pays 250 points and a little fuel; finishing pays a
   time bonus.
2. **Island Tour** — visit all 5 landmarks: Puncak Merapi (above the
   crater), Mercusuar Tanjung, Kota Pelabuhan, Teluk Air Terjun and Karang
   Biru. Each pays 300 points and fuel.
3. **Island Hopper** — take off from runway 07, fly the 3-ring circuit,
   then land back on the runway inside the touchdown zone.

## Flight model and depth

Throttle sets speed, speed makes lift, bank turns the nose, and below 26
m/s the wing stalls and the nose drops. Fuel burns with the throttle and
runs the engine dry; rings and landmarks top it up. Landing needs wheels
down, gentle and slow on the strip — a hard arrival or a hillside is a
crash, and the end screen says which. The HUD is a full glass cockpit:
compass tape, airspeed and altitude tapes, attitude indicator, vertical
speed, throttle and fuel bars, and blinking STALL / LOW FUEL / ENGINE OUT /
TERRAIN warnings. Sound is synthesised with WebAudio (engine hum that
follows the throttle, ring chimes, landing thud, crash noise) — no audio
files.

## Structure

The source is split into files with one clear job each under `game/src/`:

| File | Job |
| --- | --- |
| `config.js` | every tuning number and the mission roster |
| `random.js` | seeded PRNG and value noise (deterministic island) |
| `world.js` | the island: heightfield, town, runway, rings, landmarks |
| `physics.js` | the arcade flight model (throttle, lift, stall, ground) |
| `missions.js` | mission state, ring passing, checkpoints, scoring |
| `render.js` | the software 3D engine: sky, sea, terrain, aircraft, rings |
| `hud.js` | HUD, gauges, warnings, title / pause / end screens |
| `input.js` | keyboard, mouse steering, wheel throttle, clicks |
| `audio.js` | synthesised WebAudio sounds |
| `shots.js` | deterministic screenshot states (`?shot=start|play|land|end`) |
| `main.js` | boot, game loop and phase machine |

`main.ts` (root) hands the game in: it copies `game/` and `screenshots/`
to `/output` and writes `/output/dossier.json` with `buildDossier` from
`vendor/makefun-game.ts` (the kit's copy, unchanged). `serve.ts` is a tiny
static server for local play-testing. No file loads anything over the
network; every script, image and sound is a file under `game/` or is
computed in code.

## Screenshots

`shots.json` lists the four shots, each a real render of the game's own
code in a headless browser at 1280×800:

1. `1-start.jpg` — the title screen over the island at dawn
2. `2-play.jpg` — mid-flight on the Ring Run, closing on the gold ring
3. `3-land.jpg` — on final approach to runway 07
4. `4-end.jpg` — the mission-complete screen

## Local testing

- All 11 source modules parse under Node (`node --check`).
- Played in headless Chromium (Playwright, pipe launch): boots with no
  console errors and no failed requests; a scripted flight takes off, climbs
  and accelerates (0 → 74 m/s, throttle 100%).
- Headless autopilot test (the game's own modules in Node, no browser):
  all three missions are winnable — Ring Run 2,788 points in 223 s, Island
  Tour 2,704 in 299 s, Island Hopper 3,238 in 103 s — each with fuel left.
- Screenshots are 1280×800 JPEGs, each under 256 KiB.
