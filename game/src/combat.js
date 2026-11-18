// Combat: fists, pistol and SMG. Shooting is a ray from the camera through
// the crosshair; hits on pedestrians and police cars do damage, raise heat
// and kick off sound + tracer effects. Ammo is finite for guns, fists never run out.
import * as THREE from 'three';
import { WEAPONS } from './config.js';
import { clamp } from './random.js';

export class Combat {
  constructor(scene) {
    this.scene = scene;
    this.weapon = 'pistol';
    this.ammo = { pistol: WEAPONS.pistol.ammo, smg: WEAPONS.smg.ammo };
    this.cooldown = 0;
    this.tracers = [];
    this.muzzle = null;
  }

  select(key) {
    const map = { Digit1: 'fists', Digit2: 'pistol', Digit3: 'smg' };
    if (map[key]) this.weapon = map[key];
  }

  get def() { return WEAPONS[this.weapon]; }
  get ammoLeft() { return this.weapon === 'fists' ? Infinity : this.ammo[this.weapon]; }

  update(dt) { if (this.cooldown > 0) this.cooldown -= dt; }

  // Fire one shot from the camera. `targets` = { peds, policeCars, trafficCars }.
  // Returns { hit, killed, damage, point } for the game to react to.
  fire(camera, targets) {
    const def = this.def;
    if (this.cooldown > 0) return null;
    if (this.weapon !== 'fists' && this.ammo[this.weapon] <= 0) return { empty: true };
    this.cooldown = def.rate;
    if (this.weapon !== 'fists') this.ammo[this.weapon] -= 1;

    const origin = camera.position.clone();
    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);
    const ray = new THREE.Raycaster(origin, dir, 0.1, def.range);
    // Fists: a short sweep in front of the player instead of a ray.
    if (this.weapon === 'fists') {
      const ped = targets.peds.nearest(origin.x + dir.x * 1.6, origin.z + dir.z * 1.6, 2.2);
      if (ped) {
        const killed = targets.peds.hit(ped, def.damage);
        return { hit: 'ped', killed, damage: def.damage, point: new THREE.Vector3(ped.x, 1, ped.z) };
      }
      return { hit: null };
    }
    // Guns: raycast against simple sphere colliders (no mesh raycast cost).
    let best = null, bestD = def.range;
    const testSphere = (x, y, z, r, kind, ref) => {
      const ox = x - origin.x, oy = y - origin.y, oz = z - origin.z;
      const t = ox * dir.x + oy * dir.y + oz * dir.z;
      if (t < 0 || t > bestD) return;
      const px = origin.x + dir.x * t, py = origin.y + dir.y * t, pz = origin.z + dir.z * t;
      const d = Math.hypot(px - x, py - y, pz - z);
      if (d < r) { bestD = t; best = { kind, ref, point: new THREE.Vector3(px, py, pz) }; }
    };
    for (const p of targets.peds.peds) if (p.alive) testSphere(p.x, 1.1, p.z, 0.9, 'ped', p);
    for (const c of targets.police.cars) testSphere(c.x, 1.0, c.z, 2.2, 'police', c);
    for (const c of targets.traffic.cars) testSphere(c.x, 1.0, c.z, 2.2, 'traffic', c);
    this.spawnTracer(origin, dir, best ? bestD : def.range);
    if (!best) return { hit: null };
    if (best.kind === 'ped') {
      const killed = targets.peds.hit(best.ref, def.damage);
      return { hit: 'ped', killed, damage: def.damage, point: best.point };
    }
    if (best.kind === 'police') {
      best.ref.speed = Math.max(0, best.ref.speed - 6);
      return { hit: 'police', damage: def.damage, point: best.point };
    }
    best.ref.panic = 2;
    return { hit: 'traffic', damage: def.damage, point: best.point };
  }

  spawnTracer(origin, dir, length) {
    const geo = new THREE.BufferGeometry().setFromPoints([
      origin.clone().addScaledVector(dir, 1.2),
      origin.clone().addScaledVector(dir, Math.max(1.5, length)),
    ]);
    const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xffe08a, transparent: true, opacity: 0.95 }));
    this.scene.add(line);
    this.tracers.push({ line, life: 0.09 });
  }

  updateTracers(dt) {
    for (let i = this.tracers.length - 1; i >= 0; i--) {
      const t = this.tracers[i];
      t.life -= dt;
      if (t.life <= 0) { this.scene.remove(t.line); t.line.geometry.dispose(); this.tracers.splice(i, 1); }
    }
  }
}
