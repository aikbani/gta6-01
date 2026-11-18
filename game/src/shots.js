// The screenshot scenes behind ?shot=chase|city|mission|night (with &seed=N).
// Each one stages a real gameplay state — the player mid-chase, on foot
// downtown, mid-mission on the causeway, or escaping at night — then plays
// the real rules forward with an autopilot for a fixed time, so the frame is
// what a short game really looks like and the same seed gives the same frame.
import { WORLD } from './config.js';

const PREROLL_SECONDS = { chase: 5, city: 5, mission: 3, night: 5 };

// Autopilot: steer toward the current mission target (or along the beach
// road), throttle on, handbrake through tight turns.
function autopilot(game) {
  const target = game.missions.stageDef;
  const car = game.car;
  if (!car) return { throttle: 0, steer: 0, handbrake: false };
  const tx = target ? target.x : game.car.x + Math.sin(game.car.heading) * 60;
  const tz = target ? target.z : game.car.z + Math.cos(game.car.heading) * 60;
  const dx = tx - car.x, dz = tz - car.z;
  const want = Math.atan2(dx, dz);
  let dh = want - car.heading;
  while (dh > Math.PI) dh -= Math.PI * 2;
  while (dh < -Math.PI) dh += Math.PI * 2;
  return {
    throttle: 1,
    steer: Math.max(-1, Math.min(1, dh * 1.6)),
    handbrake: Math.abs(dh) > 1.1,
  };
}

export function stageShot(name, game) {
  const g = game;
  g.resetWorld();
  const set = (opts) => Object.assign(g.state, opts);
  let dlg = null;
  const say = (who, line, ms = 9000) => { dlg = { who, line }; g.hud.showDialogue(who.name, who.role, who.color, who.initials, line, ms); };

  if (name === 'city') {
    // On foot on the z = 0 avenue in Downtown at midday, traffic and
    // pedestrians all around. (On a road, never inside a block.)
    set({ clock: 14 * 3600, day: 1, wanted: 0, money: 1250, rep: 25, score: 340 });
    g.placePlayerOnFoot(-60, 0, Math.PI / 2);
    g.missions.start(0);
    // Stage a few cars and pedestrians on the avenue ahead so the frame
    // actually shows the traffic and the crowds (they drive/walk on during
    // the preroll and stay in view).
    const carSpots = [[40, 0, Math.PI / 2], [95, -3, Math.PI / 2], [140, 3, -Math.PI / 2], [170, 0, Math.PI / 2]];
    carSpots.forEach(([x, z, h], i) => {
      const c = g.traffic.cars[i]; if (!c) return;
      c.x = x; c.z = z; c.heading = h; c.alongZ = false; c.dir = h === Math.PI / 2 ? 1 : -1;
      c.mesh.position.set(x, 0, z); c.mesh.rotation.y = h;
    });
    const pedSpots = [[-30, 10], [10, -11], [50, 10], [85, -10], [120, 11], [-10, -10]];
    pedSpots.forEach(([x, z], i) => {
      const p = g.peds.peds[i]; if (!p) return;
      p.x = x; p.z = z; p.mesh.position.set(x, 0, z);
      p.target = { x: x + 40, z };
    });
    say({ name: 'Sol Ibarra', role: 'Hacker', color: '#00e5ff', initials: 'SI' },
      'Downtown grid is clear. Walk it, learn it — you will drive it blind one day.');
  } else if (name === 'mission') {
    // Causeway Run: mid-mission on the Palm Causeway bridge at golden hour.
    set({ clock: 17.8 * 3600, day: 2, wanted: 2, crimeTimer: 30, money: 3100, rep: 45, score: 1250 });
    g.placePlayerInCar('sports', 330, 0, Math.PI / 2);
    g.missions.start(5);
    g.missions.stage = 1; // second stage: cross to the islet lighthouse
    g.missions.placeMarker();
    g.state.wanted = 2;
    say({ name: 'Mara Kade', role: 'Fixer', color: '#ff2e88', initials: 'MK' },
      'The causeway is the only road off the islet, and the VPD knows it. Do not stop.');
  } else if (name === 'night') {
    // Heat Wave finale: five stars, night escape down the z = 0 avenue.
    set({ clock: 23.2 * 3600, day: 3, wanted: 5, crimeTimer: 30, money: 9800, rep: 120, score: 4200 });
    g.placePlayerInCar('sports', -180, 0, Math.PI / 2);
    g.missions.start(7);
    g.missions.stage = 1;
    g.missions.placeMarker();
    g.state.wanted = 5;
    say({ name: 'Mara Kade', role: 'Fixer', color: '#ff2e88', initials: 'MK' },
      'Five stars, one island, no way out but through. Lose the helicopter, Dario.');
  } else {
    // chase (default + cover): sunset beach-strip chase, three stars, heli.
    set({ clock: 18.5 * 3600, day: 1, wanted: 3, crimeTimer: 30, money: 2450, rep: 35, score: 890 });
    g.placePlayerInCar('sports', -285, 120, Math.PI);
    g.missions.start(0); // First Light: straight up the beach road to the Vela Wheel
    g.missions.stage = 0;
    g.missions.placeMarker();
    g.state.wanted = 3;
    say({ name: 'Mara Kade', role: 'Fixer', color: '#ff2e88', initials: 'MK' },
      'Three stars and a helicopter. The wheel is behind you — drive like it matters.');
  }

  // Play the real rules forward so the frame is mid-action, not a still life.
  const preroll = PREROLL_SECONDS[name] ?? 5;
  g.state.autopilot = true;
  for (let i = 0; i < preroll * 60; i++) {
    const a = autopilot(g);
    g.stepFixed(1 / 60, a);
  }
  g.state.autopilot = false;
  // Park the helicopter in frame ahead of the player (high, ahead-left) so the
  // chase reads in the screenshot, not just in the VPD list.
  if (g.police.heli && (name === 'chase' || name === 'night')) {
    const h = g.police.heli;
    const fx = Math.sin(g.pHeading), fz = Math.cos(g.pHeading);
    const lx = Math.cos(g.pHeading), lz = -Math.sin(g.pHeading);
    h.mesh.position.set(g.px + fx * 45 + lx * 10, 26, g.pz + fz * 45 + lz * 10);
    h.mesh.rotation.y = g.pHeading + Math.PI;
    h.spot.intensity = name === 'night' ? 260 : 0;
  }
  // Chase cover: stage the pursuit for the frame — one VPD interceptor
  // head-on ahead in the oncoming lane, two more in formation behind, and the
  // Comet back up to chase speed (the rams during the preroll slow it down).
  if (name === 'chase') {
    const fx = Math.sin(g.pHeading), fz = Math.cos(g.pHeading);
    const lx = Math.cos(g.pHeading), lz = -Math.sin(g.pHeading);
    const placeCop = (i, ax, az, heading, state, dist) => {
      const cop = g.police.cars[i]; if (!cop) return;
      cop.x = g.px + ax; cop.z = g.pz + az;
      cop.heading = heading; cop.state = state; cop.dist = dist;
      cop.mesh.position.set(cop.x, 0, cop.z);
      cop.mesh.rotation.y = cop.heading;
    };
    placeCop(0, fx * 38 + lx * 3.5, fz * 38 + lz * 3.5, g.pHeading + Math.PI, 'PURSUIT', 38);
    placeCop(1, -fx * 25 + lx * 6, -fz * 25 + lz * 6, g.pHeading, 'PURSUIT', 25);
    placeCop(2, -fx * 32 - lx * 6, -fz * 32 - lz * 6, g.pHeading, 'PURSUIT', 32);
    if (g.car) { g.car.speed = 45; g.car.damage = Math.min(g.car.damage, 25); }
  }
  // Re-show the dialogue with a long timeout: virtual-time budgets fast-forward
  // timers, and the card must still be on screen when the screenshot is taken.
  if (dlg) g.hud.showDialogue(dlg.who.name, dlg.who.role, dlg.who.color, dlg.who.initials, dlg.line, 60000);
  // Hide any transient toast so it cannot cover the wheel or the road.
  g.hud.toastEl.style.opacity = '0';
  g.hud.update(g.hudState());
  window.__shotReady = true;
  return name;
}
