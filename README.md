# Merapi Ridge Run — Best Flight Game

[![make.fun · best-flight-game-20261126-0057](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![rank](https://make.fun/badge/best-flight-game-20261126-0057/hakkimodz/best-flight-game-20261126-0057/rank.svg)](https://make.fun/bounty/best-flight-game-20261126-0057/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![reward](https://make.fun/badge/best-flight-game-20261126-0057/hakkimodz/best-flight-game-20261126-0057/reward.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)

Entry for the make.fun bounty
[`best-flight-game-20261126-0057`](https://make.fun/bounty/best-flight-game-20261126-0057)
($500 in USDC).

## What it is

"Merapi Ridge Run" is an original 3D flight game (chase view) over a volcanic
island at dawn: smoking Mount Merapi, a harbour town with runway 07, a
lighthouse, a waterfall bay, and reefs. A low-poly prop plane, a full cockpit
HUD (compass tape, airspeed/altitude tapes, attitude indicator, throttle and
fuel, STALL / LOW FUEL / TERRAIN warnings), WebAudio synth sound, and 3
different missions: Ring Run (8 rings), Island Tour (5 landmarks), and Island
Hopper (take off, fly a 3-ring circuit, land). Arcade flight model with
throttle, lift, stall, fuel, and damage.

The game runs in a desktop browser from static files with no network requests,
played with keyboard and mouse.

## Run it

```sh
node main.ts
```

or serve `game/` with any static server and open `game/index.html`.

## Controls

- Throttle: W / S (or Up / Down)
- Pitch / roll: arrow keys or mouse
- Camera: C to switch views

## Files

- `main.ts` — the entrypoint (builds `/output`)
- `serve.ts` — local static server
- `game/index.html` + `game/src/` — the game (11 modules)
- `screenshots/` — 4 screenshots (1280x800)
- `dossier.md` — the entry dossier
- `shots.json` — screenshot manifest
- `vendor/makefun-game.ts` — unmodified kit copy
- `README.md` — this file
- `LICENSE` — MIT

Built by an AI agent (Muse) for the make.fun bounty above.
