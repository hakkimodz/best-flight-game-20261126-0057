// Merapi Ridge Run — screenshot states. The screenshots are real renders of
// the game's own code, driven by ?shot=, so a reviewer can reproduce them:
//   ?shot=start — the title screen over the island at dawn
//   ?shot=play  — mid-flight, chasing the next ring with the HUD live
//   ?shot=land  — on final approach to the runway, gear down, low and slow
//   ?shot=end   — the mission-complete screen
// A ?seed= parameter picks the island seed (default 1). The shots are
// deterministic: the same URL always renders the same frame.

export function parseShot() {
  const params = new URLSearchParams(window.location.search);
  return {
    shot: params.get('shot') || null,
    seed: Number(params.get('seed') || 1) || 1,
  };
}

// Pose the game for a screenshot. Called once after the world is built;
// returns the phase and mission id the shot wants, or null for normal play.
export function applyShot(shot, game) {
  if (!shot) return null;
  if (shot === 'start') {
    game.phase = 'title';
    game.aircraft.resetAirborne(-1800, 420, 900, 2.4, 55);
    game.aircraft.throttle = 0.6;
    return { phase: 'title' };
  }
  if (shot === 'play') {
    // Mid-flight on the Ring Run, closing on ring 3 with the HUD live.
    // Ring 2 sits at (-1600, -700), ring 3 at (-600, -1600): the course
    // between them heads 2.30 rad, so the aircraft is placed on it.
    game.startMission('rings');
    game.aircraft.resetAirborne(-1100, 300, -1150, 2.3, 62);
    game.aircraft.throttle = 0.78;
    game.mission.ringIndex = 2;
    game.mission.score = 500;
    game.mission.time = 74;
    game.phase = 'flying';
    return { phase: 'flying' };
  }
  if (shot === 'land') {
    // Final approach to runway 07, low over the town, just off the
    // centreline so the strip reads beside the aircraft in the frame.
    game.startMission('landing');
    const ax = -1597;
    const az = 682;
    game.aircraft.resetAirborne(ax, game.world.heightAt(ax, az) + 120, az, 1.22, 40);
    game.aircraft.throttle = 0.4;
    game.mission.ringIndex = 3;
    game.mission.tookOff = true;
    game.mission.score = 1150;
    game.mission.time = 210;
    game.phase = 'flying';
    return { phase: 'flying' };
  }
  if (shot === 'end') {
    game.startMission('rings');
    game.mission.score = 2450;
    game.mission.time = 312;
    game.mission.ringIndex = 8;
    game.mission.done = true;
    game.mission.won = true;
    game.aircraft.resetAirborne(200, 300, 1400, 2.8, 50);
    game.phase = 'over';
    return { phase: 'over' };
  }
  return null;
}
