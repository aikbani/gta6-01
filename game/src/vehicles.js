// Cars: a box-built car factory (body, cabin, wheels, lights, light bar for
// police) and the player's arcade driving — accel, brake, reverse, steering,
// handbrake drift, damage and collisions with buildings and other cars.
import * as THREE from 'three';
import { VEHICLES } from './config.js';
import { clamp, angleLerp } from './random.js';

export function buildCarMesh(kind, colorOverride) {
  const def = VEHICLES[kind] || VEHICLES.sedan;
  const color = colorOverride ?? def.color;
  const g = new THREE.Group();
  const paint = new THREE.MeshStandardMaterial({ color, roughness: 0.32, metalness: 0.35 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x2a3a55, roughness: 0.15, metalness: 0.6 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x14181f, roughness: 0.9 });
  const isTruck = kind === 'truck', isVan = kind === 'van';
  const len = isTruck ? 7.2 : isVan ? 5.6 : kind === 'sports' ? 4.6 : 4.4;
  const wid = isTruck || isVan ? 2.5 : 2.0;
  const body = new THREE.Mesh(new THREE.BoxGeometry(wid, 0.75, len), paint);
  body.position.y = 0.62; body.castShadow = true; g.add(body);
  const cabinH = isTruck ? 1.1 : 0.62;
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(wid - 0.3, cabinH, len * (isTruck ? 0.32 : 0.5)), glass);
  cabin.position.set(0, 1.28, isTruck ? len * 0.28 : -len * 0.05); cabin.castShadow = true; g.add(cabin);
  if (isTruck) {
    const bed = new THREE.Mesh(new THREE.BoxGeometry(wid - 0.2, 0.9, len * 0.55),
      new THREE.MeshStandardMaterial({ color: 0x6b5a35, roughness: 0.9 }));
    bed.position.set(0, 1.35, -len * 0.22); g.add(bed);
  }
  // Wheels.
  const wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.3, 12);
  g.userData.wheels = [];
  for (const [wx, wz] of [[-wid / 2, len * 0.32], [wid / 2, len * 0.32], [-wid / 2, -len * 0.32], [wid / 2, -len * 0.32]]) {
    const w = new THREE.Mesh(wheelGeo, dark);
    w.rotation.z = Math.PI / 2; w.position.set(wx, 0.38, wz); g.add(w);
    g.userData.wheels.push(w);
  }
  // Headlights + taillights.
  const headMat = new THREE.MeshStandardMaterial({ color: 0xfff6c0, emissive: 0xffedb0, emissiveIntensity: 0.9 });
  const tailMat = new THREE.MeshStandardMaterial({ color: 0x881111, emissive: 0xff2222, emissiveIntensity: 0.9 });
  for (const s of [-1, 1]) {
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.2, 0.12), headMat);
    h.position.set(s * (wid / 2 - 0.35), 0.68, len / 2 + 0.02); g.add(h);
    const t = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.18, 0.12), tailMat);
    t.position.set(s * (wid / 2 - 0.35), 0.68, -len / 2 - 0.02); g.add(t);
  }
  if (kind === 'police') {
    const barMat = new THREE.MeshStandardMaterial({ color: 0x11151c, emissive: 0x2244ff, emissiveIntensity: 1.6 });
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.22, 0.4), barMat);
    bar.position.set(0, 1.72, -0.1); g.add(bar);
    g.userData.lightBar = bar;
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(wid + 0.02, 0.3, len * 0.6),
      new THREE.MeshStandardMaterial({ color: 0xf2f2f2, roughness: 0.5 }));
    stripe.position.y = 0.62; g.add(stripe);
  }
  if (kind === 'sports') {
    // Rear wing — the Comet GT's signature.
    const wing = new THREE.Mesh(new THREE.BoxGeometry(wid - 0.2, 0.1, 0.5), paint);
    wing.position.set(0, 1.25, -len / 2 + 0.25); g.add(wing);
    for (const s of [-1, 1]) {
      const strut = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.35, 0.3), dark);
      strut.position.set(s * (wid / 2 - 0.4), 1.05, -len / 2 + 0.25); g.add(strut);
    }
  }
  if (kind === 'taxi') {
    const sign = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.25, 0.5),
      new THREE.MeshStandardMaterial({ color: 0x11151c, emissive: 0xffc93c, emissiveIntensity: 0.8 }));
    sign.position.set(0, 1.68, -0.1); g.add(sign);
  }
  g.userData.length = len; g.userData.width = wid;
  return g;
}

export class PlayerCar {
  constructor(scene, kind, x, z, heading) {
    this.def = VEHICLES[kind];
    this.kind = kind;
    this.mesh = buildCarMesh(kind);
    this.mesh.position.set(x, 0, z);
    this.mesh.rotation.y = heading;
    scene.add(this.mesh);
    this.x = x; this.z = z; this.heading = heading;
    this.speed = 0;            // m/s, forward positive
    this.steer = 0;
    this.damage = 0;           // 0..100, 100 = wrecked
    this.drift = 0;
    this.skid = 0;             // seconds of handbrake slide left
    this.hitCooldown = 0;      // damage is per hit, not per step while touching
  }

  // Arcade step: throttle -1..1, steer -1..1. Returns events {crashed, nearMiss}.
  step(dt, throttle, steer, handbrake, city, others) {
    const def = this.def;
    const events = { crashed: 0, nearMiss: false };
    // Steering eases at speed; reversing flips it.
    const steerTarget = steer * (this.speed >= 0 ? 1 : -1);
    this.steer += (steerTarget - this.steer) * Math.min(1, dt * 8);
    const grip = handbrake ? 0.35 : def.grip;
    const maxSteer = 0.55 / (1 + Math.abs(this.speed) * 0.045);
    this.heading += this.steer * maxSteer * (this.speed / 8) * dt * grip * 2.4;
    if (throttle > 0) this.speed += def.accel * throttle * dt * (1 - Math.abs(this.speed) / def.top);
    else if (throttle < 0) {
      if (this.speed > 0.5) this.speed -= 34 * dt;         // brake
      else this.speed += def.accel * 0.55 * throttle * dt; // reverse
    } else this.speed -= Math.sign(this.speed) * Math.min(Math.abs(this.speed), 9 * dt);
    if (handbrake) {
      this.speed -= Math.sign(this.speed) * Math.min(Math.abs(this.speed), 16 * dt);
      this.skid = 0.9;
      this.drift = clamp(this.drift + dt * 2, 0, 1);
    } else this.drift = Math.max(0, this.drift - dt * 2);
    this.speed = clamp(this.speed, -14, def.top);
    if (Math.abs(this.speed) < 0.05 && throttle === 0) this.speed = 0;

    const nx = this.x + Math.sin(this.heading) * this.speed * dt;
    const nz = this.z + Math.cos(this.heading) * this.speed * dt;
    if (this.hitCooldown > 0) this.hitCooldown -= dt;
    // Building collision: slide along the wall, take damage on hard hits.
    const hitSpeed = Math.abs(this.speed);
    const pushed = city.collideCircle(nx, nz, 1.6);
    if (pushed.x !== nx || pushed.z !== nz) {
      if (hitSpeed > 8 && this.hitCooldown <= 0) {
        this.damage = Math.min(100, this.damage + Math.min(12, hitSpeed * 0.45));
        events.crashed = hitSpeed; this.hitCooldown = 0.6;
      }
      this.speed *= 0.45;
    }
    this.x = clamp(pushed.x, -545, 545); this.z = clamp(pushed.z, -545, 545);
    // Car-to-car bumps.
    for (const o of others) {
      if (!o || o === this) continue;
      const dx = this.x - o.x, dz = this.z - o.z;
      const d = Math.hypot(dx, dz);
      const minD = 2.6;
      if (d < minD && d > 0.01) {
        const push = (minD - d) / 2;
        this.x += (dx / d) * push; this.z += (dz / d) * push;
        if (Math.abs(this.speed) > 6 && this.hitCooldown <= 0) {
          this.damage = Math.min(100, this.damage + Math.min(8, Math.abs(this.speed) * 0.18));
          events.crashed = Math.abs(this.speed); this.hitCooldown = 0.6;
        }
        // Near miss: fast pass within 4 m without touching.
        events.nearMiss = false;
        this.speed *= 0.85;
        if (o.onBump) o.onBump(this.speed);
      } else if (d < 5.5 && d >= minD && Math.abs(this.speed) > 18) {
        events.nearMiss = true;
      }
    }
    this.mesh.position.set(this.x, 0, this.z);
    this.mesh.rotation.y = this.heading;
    // Body roll + wheel spin for feel.
    this.mesh.rotation.z = -this.steer * Math.min(0.1, Math.abs(this.speed) * 0.002) - this.drift * this.steer * 0.12;
    for (const w of this.mesh.userData.wheels) w.rotation.x += this.speed * dt * 2.2;
    if (this.skid > 0) this.skid -= dt;
    return events;
  }

  get speedKmh() { return Math.abs(this.speed) * 3.6; }
}

// The player on foot: a simple figure (jacket, head, legs) that walks and runs.
export function buildPersonMesh(jacketColor, skinColor = 0xd9a066) {
  const g = new THREE.Group();
  const jacket = new THREE.MeshStandardMaterial({ color: jacketColor, roughness: 0.85 });
  const skin = new THREE.MeshStandardMaterial({ color: skinColor, roughness: 0.8 });
  const pants = new THREE.MeshStandardMaterial({ color: 0x2a3040, roughness: 0.9 });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.75, 0.36), jacket);
  torso.position.y = 1.05; torso.castShadow = true; g.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 12, 10), skin);
  head.position.y = 1.62; head.castShadow = true; g.add(head);
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.27, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2.2),
    new THREE.MeshStandardMaterial({ color: 0x1a1210, roughness: 1 }));
  hair.position.y = 1.66; g.add(hair);
  g.userData.legs = [];
  for (const s of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.62, 0.24), pants);
    leg.position.set(s * 0.16, 0.34, 0); g.add(leg); g.userData.legs.push(leg);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.6, 0.2), jacket);
    arm.position.set(s * 0.42, 1.05, 0); g.add(arm);
  }
  return g;
}
