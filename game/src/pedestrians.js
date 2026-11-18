// Pedestrians: islanders strolling the sidewalks, crossing at corners,
// scattering when a car screams past or a shot rings out. A hit pedestrian
// raises the wanted level — the game notices.
import { buildPersonMesh } from './vehicles.js';
import { WORLD } from './config.js';
import { makeRng, clamp } from './random.js';

const JACKETS = [0xff6f61, 0x2ec4b6, 0xffc93c, 0x7a6a9e, 0xe8e4da, 0x4f7fa8, 0xff9e4f, 0x5e8a6a];

export class Pedestrians {
  constructor(scene, city, seed, count = 44) {
    this.scene = scene; this.city = city;
    this.rng = makeRng(seed + 202);
    this.peds = [];
    for (let i = 0; i < count; i++) this.spawn(true);
  }

  randomSidewalkSpot() {
    const rng = this.rng;
    const road = rng.pick(WORLD.roads);
    const alongZ = rng.chance(0.5);
    const off = (rng.chance(0.5) ? 1 : -1) * rng.range(9, 14);
    if (alongZ) return { x: road + off, z: rng.range(-280, 280) };
    return { x: rng.range(-280, 280), z: road + off };
  }

  spawn(anywhere) {
    const rng = this.rng;
    const spot = this.randomSidewalkSpot();
    if (this.city.insideBuilding(spot.x, spot.z, 1)) return null;
    const mesh = buildPersonMesh(rng.pick(JACKETS));
    mesh.position.set(spot.x, 0, spot.z);
    this.scene.add(mesh);
    const ped = {
      mesh, x: spot.x, z: spot.z,
      heading: rng.range(0, Math.PI * 2),
      speed: rng.range(1.1, 2.0),
      panic: 0, walkPhase: rng.range(0, Math.PI * 2),
      target: null, alive: true, health: 100,
    };
    ped.target = this.nextTarget(ped);
    this.peds.push(ped);
    return ped;
  }

  nextTarget(ped) {
    const rng = this.rng;
    // Walk along a sidewalk to a nearby corner, then pick a new one.
    const road = rng.pick(WORLD.roads);
    const alongZ = rng.chance(0.5);
    if (alongZ) return { x: road + (rng.chance(0.5) ? 1 : -1) * rng.range(9, 14), z: rng.range(-280, 280) };
    return { x: rng.range(-280, 280), z: road + (rng.chance(0.5) ? 1 : -1) * rng.range(9, 14) };
  }

  update(dt, playerPos, playerSpeed, threat) {
    for (const ped of this.peds) {
      if (!ped.alive) continue;
      const dPlayer = Math.hypot(ped.x - playerPos.x, ped.z - playerPos.z);
      if ((threat && dPlayer < 40) || (playerSpeed > 14 && dPlayer < 12)) ped.panic = 2.5;
      let speed = ped.speed;
      let tx = ped.target.x, tz = ped.target.z;
      if (ped.panic > 0) {
        ped.panic -= dt; speed = 5.2;
        // Run away from the player.
        const dx = ped.x - playerPos.x, dz = ped.z - playerPos.z;
        const d = Math.hypot(dx, dz) || 1;
        tx = ped.x + (dx / d) * 30; tz = ped.z + (dz / d) * 30;
      }
      const dx = tx - ped.x, dz = tz - ped.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 1.5 && ped.panic <= 0) { ped.target = this.nextTarget(ped); continue; }
      const want = Math.atan2(dx, dz);
      let dh = want - ped.heading;
      while (dh > Math.PI) dh -= Math.PI * 2;
      while (dh < -Math.PI) dh += Math.PI * 2;
      ped.heading += clamp(dh, -dt * 4, dt * 4);
      ped.x += Math.sin(ped.heading) * speed * dt;
      ped.z += Math.cos(ped.heading) * speed * dt;
      const pushed = this.city.collideCircle(ped.x, ped.z, 0.5);
      ped.x = clamp(pushed.x, -320, 320); ped.z = clamp(pushed.z, -320, 320);
      ped.walkPhase += dt * speed * 3.2;
      ped.mesh.position.set(ped.x, 0, ped.z);
      ped.mesh.rotation.y = ped.heading;
      const swing = Math.sin(ped.walkPhase) * 0.5;
      ped.mesh.userData.legs[0].rotation.x = swing;
      ped.mesh.userData.legs[1].rotation.x = -swing;
    }
  }

  // A hit: the pedestrian goes down (and the wanted level notices elsewhere).
  hit(ped, damage) {
    ped.health -= damage;
    if (ped.health <= 0 && ped.alive) {
      ped.alive = false;
      ped.mesh.rotation.x = -Math.PI / 2; // fall flat
      ped.mesh.position.y = 0.25;
      return true;
    }
    ped.panic = 3;
    return false;
  }

  nearest(x, z, maxD) {
    let best = null, bd = maxD;
    for (const p of this.peds) {
      if (!p.alive) continue;
      const d = Math.hypot(p.x - x, p.z - z);
      if (d < bd) { bd = d; best = p; }
    }
    return best;
  }
}
