// Traffic: civilian cars that cruise the road grid on fixed lanes, stop for
// nothing, and panic (speed off) when the player steals a car or shoots.
// Each car loops a route: pick a road, drive to its end, turn onto another.
import { buildCarMesh } from './vehicles.js';
import { WORLD } from './config.js';
import { makeRng, clamp, angleLerp } from './random.js';

const KINDS = ['sedan', 'sedan', 'taxi', 'van', 'sedan', 'truck', 'sports'];

export class Traffic {
  constructor(scene, city, seed, count = 34) {
    this.scene = scene; this.city = city;
    this.rng = makeRng(seed + 101);
    this.cars = [];
    for (let i = 0; i < count; i++) this.spawnCar(true);
  }

  randomRoadSpot() {
    const rng = this.rng;
    if (rng.chance(0.15)) return { x: WORLD.beachX, z: rng.range(-280, 280), alongZ: true };
    if (rng.chance(0.12)) return { x: rng.range(335, 470), z: 0, alongZ: false };
    const road = rng.pick(WORLD.roads);
    const alongZ = rng.chance(0.5);
    return alongZ
      ? { x: road, z: rng.range(-280, 280), alongZ: true }
      : { x: rng.range(-280, 280), z: road, alongZ: false };
  }

  spawnCar(anywhere) {
    const rng = this.rng;
    const spot = this.randomRoadSpot();
    const kind = rng.pick(KINDS);
    const mesh = buildCarMesh(kind);
    this.scene.add(mesh);
    const dir = rng.chance(0.5) ? 1 : -1;
    const heading = spot.alongZ ? (dir > 0 ? 0 : Math.PI) : (dir > 0 ? Math.PI / 2 : -Math.PI / 2);
    const car = {
      mesh, kind, x: spot.x, z: spot.z, heading,
      speed: rng.range(9, 15), targetSpeed: rng.range(9, 15),
      alongZ: spot.alongZ, dir, lane: (rng.chance(0.5) ? 1 : -1) * 2.6,
      panic: 0, onBump: null, color: mesh.children.length ? 0 : 0,
    };
    this.placeOnLane(car);
    this.cars.push(car);
    return car;
  }

  placeOnLane(car) {
    if (car.alongZ) car.x += car.lane * 0; // lane offset applied across the road
    car.mesh.position.set(car.x, 0, car.z);
    car.mesh.rotation.y = car.heading;
  }

  // Keep a car inside the grid: at a road end, turn onto a cross road.
  retarget(car) {
    const rng = this.rng;
    const roads = WORLD.roads;
    if (car.alongZ) {
      const nz = clamp(car.z + car.dir * 10, -290, 290);
      car.z = nz;
      if (Math.abs(car.z) > 285) {
        car.alongZ = false; car.dir = rng.chance(0.5) ? 1 : -1;
        car.heading = car.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
        car.x = clamp(car.x, -280, 280);
      }
    } else {
      const nx = clamp(car.x + car.dir * 10, -290, 290);
      car.x = nx;
      if (Math.abs(car.x) > 285) {
        car.alongZ = true; car.dir = rng.chance(0.5) ? 1 : -1;
        car.heading = car.dir > 0 ? 0 : Math.PI;
        car.z = clamp(car.z, -280, 280);
      }
    }
    // Occasionally turn at an intersection.
    if (rng.chance(0.002)) {
      const road = rng.pick(roads);
      if (car.alongZ && Math.abs(car.z - road) < 30) { car.alongZ = false; car.z = road; car.dir = rng.chance(0.5) ? 1 : -1; car.heading = car.dir > 0 ? Math.PI / 2 : -Math.PI / 2; }
      else if (!car.alongZ && Math.abs(car.x - road) < 30) { car.alongZ = true; car.x = road; car.dir = rng.chance(0.5) ? 1 : -1; car.heading = car.dir > 0 ? 0 : Math.PI; }
    }
  }

  update(dt, playerPos, playerSpeed) {
    for (const car of this.cars) {
      if (car.panic > 0) car.panic -= dt;
      const target = car.panic > 0 ? 24 : car.targetSpeed;
      car.speed += (target - car.speed) * Math.min(1, dt * 1.2);
      // Slow down if another car is right ahead.
      for (const o of this.cars) {
        if (o === car) continue;
        const dx = o.x - car.x, dz = o.z - car.z;
        const ahead = car.alongZ ? dz * car.dir : dx * car.dir;
        const side = car.alongZ ? Math.abs(dx) : Math.abs(dz);
        if (ahead > 0 && ahead < 9 && side < 3) { car.speed = Math.min(car.speed, Math.max(0, o.speed - 2)); break; }
      }
      car.x += Math.sin(car.heading) * car.speed * dt;
      car.z += Math.cos(car.heading) * car.speed * dt;
      this.retarget(car);
      car.mesh.position.set(car.x, 0, car.z);
      car.mesh.rotation.y = car.heading;
      for (const w of car.mesh.userData.wheels) w.rotation.x += car.speed * dt * 2.2;
    }
  }

  panicAll() { for (const c of this.cars) c.panic = 3; }

  nearest(x, z, maxD) {
    let best = null, bd = maxD;
    for (const c of this.cars) {
      const d = Math.hypot(c.x - x, c.z - z);
      if (d < bd) { bd = d; best = c; }
    }
    return best;
  }

  remove(car) {
    this.scene.remove(car.mesh);
    const i = this.cars.indexOf(car);
    if (i >= 0) this.cars.splice(i, 1);
    // Keep the streets full: a fresh car joins from the edge of the grid.
    this.spawnCar(false);
  }
}
