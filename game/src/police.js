// The Vela Bay Police Department: interceptors that pursue, ram and roadblock,
// and the VPD helicopter that joins at three stars with a searchlight.
// Units are named (UNIT 12, UNIT 27…) so the HUD's police response list can
// show who is doing what and how far away they are.
import * as THREE from 'three';
import { buildCarMesh } from './vehicles.js';
import { clamp, angleLerp } from './random.js';

const UNIT_NAMES = ['UNIT 07', 'UNIT 12', 'UNIT 19', 'UNIT 23', 'UNIT 27', 'UNIT 31', 'UNIT 44', 'UNIT 58'];

export class Police {
  constructor(scene, city, seed) {
    this.scene = scene; this.city = city;
    this.cars = [];
    this.heli = null;
    this.heliLight = null;
    this.unitCounter = 0;
    this.roadblock = null;
  }

  wantedCount(wanted) { return Math.min(wanted, 3); }

  spawnCar(playerPos, heading) {
    const mesh = buildCarMesh('police');
    this.scene.add(mesh);
    const a = Math.random() * Math.PI * 2;
    const car = {
      mesh, name: UNIT_NAMES[this.unitCounter % UNIT_NAMES.length],
      x: playerPos.x + Math.sin(a) * 55, z: playerPos.z + Math.cos(a) * 55,
      heading, speed: 20, state: 'PURSUIT', stateT: 0,
      flash: Math.random() * 10,
    };
    this.unitCounter += 1;
    const p = this.city.nearestRoadPoint(car.x, car.z);
    car.x = p.x; car.z = p.z;
    this.cars.push(car);
    return car;
  }

  spawnHeli(playerPos) {
    if (this.heli) return;
    const g = new THREE.Group();
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x1c2733, roughness: 0.5, metalness: 0.4 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(3.2, 1.6, 6.5), bodyMat);
    body.castShadow = true; g.add(body);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.7, 5), bodyMat);
    tail.position.set(0, 0.4, -5.2); g.add(tail);
    const rotor = new THREE.Mesh(new THREE.BoxGeometry(11, 0.12, 0.6), new THREE.MeshStandardMaterial({ color: 0x11151c }));
    rotor.position.y = 1.2; g.add(rotor);
    g.userData.rotor = rotor;
    const lampMat = new THREE.MeshStandardMaterial({ color: 0xfff2c0, emissive: 0xffe08a, emissiveIntensity: 2 });
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 6), lampMat);
    lamp.position.set(0, -1, 2.5); g.add(lamp);
    const spot = new THREE.SpotLight(0xfff2c0, 0, 90, 0.35, 0.5, 1.2);
    spot.position.set(0, -1, 2.5);
    g.add(spot); g.add(spot.target);
    spot.target.position.set(0, -40, 0);
    g.position.set(playerPos.x + 20, 42, playerPos.z - 20);
    this.scene.add(g);
    this.heli = { mesh: g, spot, angle: 0, x: playerPos.x, z: playerPos.z };
  }

  removeHeli() {
    if (!this.heli) return;
    this.scene.remove(this.heli.mesh);
    this.heli = null;
  }

  setRoadblock(playerPos, heading) {
    this.clearRoadblock();
    const mesh = buildCarMesh('police');
    this.scene.add(mesh);
    // Park sideways across the road ahead of the player.
    const fx = Math.sin(heading), fz = Math.cos(heading);
    const bx = playerPos.x + fx * 45, bz = playerPos.z + fz * 45;
    const p = this.city.nearestRoadPoint(bx, bz);
    mesh.position.set(p.x, 0, p.z);
    mesh.rotation.y = heading + Math.PI / 2;
    this.roadblock = { mesh, x: p.x, z: p.z };
  }

  clearRoadblock() {
    if (!this.roadblock) return;
    this.scene.remove(this.roadblock.mesh);
    this.roadblock = null;
  }

  // Keep the force matched to the wanted level; returns the unit list for the HUD.
  update(dt, wanted, playerPos, playerHeading, playerSpeed, isNight) {
    const want = this.wantedCount(wanted);
    while (this.cars.length < want) this.spawnCar(playerPos, playerHeading);
    while (this.cars.length > want) {
      const c = this.cars.pop();
      this.scene.remove(c.mesh);
    }
    if (wanted >= 3) this.spawnHeli(playerPos); else this.removeHeli();
    if (wanted >= 3 && !this.roadblock && Math.random() < dt * 0.15) this.setRoadblock(playerPos, playerHeading);
    if (wanted < 3) this.clearRoadblock();

    for (const car of this.cars) {
      car.stateT += dt;
      const dx = playerPos.x - car.x, dz = playerPos.z - car.z;
      const dist = Math.hypot(dx, dz);
      const wantHeading = Math.atan2(dx, dz);
      // Ram when close, pursue otherwise; back off and re-approach after a hit.
      if (dist < 4 && car.state !== 'RAM') { car.state = 'RAM'; car.stateT = 0; }
      else if (car.state === 'RAM' && car.stateT > 0.8) { car.state = 'PURSUIT'; car.stateT = 0; }
      const targetSpeed = car.state === 'RAM' ? 52 : 46;
      car.speed += (targetSpeed - car.speed) * Math.min(1, dt * 1.5);
      const turn = car.state === 'RAM' ? 5.5 : 3.2;
      car.heading = angleLerp(car.heading, wantHeading, Math.min(1, dt * turn));
      car.x += Math.sin(car.heading) * car.speed * dt;
      car.z += Math.cos(car.heading) * car.speed * dt;
      const pushed = this.city.collideCircle(car.x, car.z, 1.6);
      car.x = pushed.x; car.z = pushed.z;
      car.mesh.position.set(car.x, 0, car.z);
      car.mesh.rotation.y = car.heading;
      for (const w of car.mesh.userData.wheels) w.rotation.x += car.speed * dt * 2.2;
      // Flashing light bar: alternate red/blue.
      car.flash += dt * 9;
      if (car.mesh.userData.lightBar) {
        const red = Math.sin(car.flash) > 0;
        car.mesh.userData.lightBar.material.emissive.setHex(red ? 0xff2222 : 0x2244ff);
        car.mesh.userData.lightBar.material.emissiveIntensity = 2.2;
      }
      car.dist = dist;
    }

    if (this.heli) {
      const h = this.heli;
      h.angle += dt * 0.35;
      const hx = playerPos.x + Math.sin(h.angle) * 26;
      const hz = playerPos.z + Math.cos(h.angle) * 26;
      h.x = hx; h.z = hz;
      h.mesh.position.set(hx, 42 + Math.sin(h.angle * 2.3) * 2, hz);
      h.mesh.rotation.y = Math.atan2(playerPos.x - hx, playerPos.z - hz);
      h.mesh.userData.rotor.rotation.y += dt * 22;
      h.spot.intensity = isNight ? 260 : 0;
    }
    return this.cars.map((c) => ({ name: c.name, state: c.state, dist: c.dist ?? 0 }));
  }

  // Distance from the nearest unit — used for wanted decay (lose them to cool off).
  // No units yet means the heat is still right on top of you: never decay on that.
  nearestDist() {
    if (this.cars.length === 0) return 0;
    let d = Infinity;
    for (const c of this.cars) d = Math.min(d, c.dist ?? Infinity);
    return d;
  }
}
