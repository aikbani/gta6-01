// Vela Bay itself: the island, its road grid, buildings, palms, beach,
// the Vela Wheel ferris wheel, the Palm Causeway bridge and the lighthouse
// islet. All geometry is procedural boxes/cylinders/tori with canvas-made
// textures — no image files, no borrowed art.
import * as THREE from 'three';
import { WORLD, PALETTE, DISTRICTS } from './config.js';
import { makeRng, clamp } from './random.js';

function canvasTexture(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Facade: lit windows on a warm wall, drawn once and reused by every tower.
function facadeTexture(base, lit) {
  return canvasTexture(128, 256, (g, w, h) => {
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    for (let y = 8; y < h - 8; y += 22) {
      for (let x = 8; x < w - 8; x += 18) {
        const on = Math.random() < 0.55;
        g.fillStyle = on ? lit : '#20242e';
        g.fillRect(x, y, 11, 14);
      }
    }
  });
}

// Asphalt with a dashed centre line, tiled along each road.
function roadTexture() {
  return canvasTexture(64, 128, (g, w, h) => {
    g.fillStyle = '#2c2f36'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#f2c94c'; g.fillRect(w / 2 - 2, 8, 4, 44);
    g.fillStyle = '#e8e4da'; g.fillRect(3, 0, 2, h); g.fillRect(w - 5, 0, 2, h);
  });
}

export class City {
  constructor(scene, seed) {
    this.scene = scene;
    this.rng = makeRng(seed);
    this.buildings = [];   // {x, z, hw, hd, h} AABBs for collision + spawn tests
    this.palms = [];
    this.wheel = null;     // rotating ferris wheel group
    this.wheelLights = [];
    this.streetLights = []; // emissive lamp meshes, lit at night
    this.beacons = [];     // mission marker beacons (added by missions)
    this.build();
  }

  build() {
    const rng = this.rng;
    const s = this.scene;
    const H = WORLD.half;

    // Land, beach and sea.
    const land = new THREE.Mesh(
      new THREE.PlaneGeometry(H * 2 + 60, H * 2 + 60),
      new THREE.MeshStandardMaterial({ color: 0x8a7f6a, roughness: 1 }));
    land.rotation.x = -Math.PI / 2; land.receiveShadow = true; s.add(land);

    const sea = new THREE.Mesh(
      new THREE.PlaneGeometry(2400, 2400),
      new THREE.MeshStandardMaterial({ color: PALETTE.sea, roughness: 0.25, metalness: 0.1 }));
    sea.rotation.x = -Math.PI / 2; sea.position.set(-H - 600, -0.4, 0); s.add(sea);
    const seaEast = sea.clone(); seaEast.position.set(H + 700, -0.4, 0); s.add(seaEast);
    const seaSouth = sea.clone(); seaSouth.position.set(0, -0.4, H + 700); s.add(seaSouth);
    const seaNorth = sea.clone(); seaNorth.position.set(0, -0.4, -H - 700); s.add(seaNorth);

    const sand = new THREE.Mesh(
      new THREE.PlaneGeometry(70, H * 2 + 60),
      new THREE.MeshStandardMaterial({ color: PALETTE.sand, roughness: 1 }));
    sand.rotation.x = -Math.PI / 2; sand.position.set(-H - 5, 0.05, 0); s.add(sand);

    // Roads: asphalt strips along every avenue and street, plus the beach road.
    const roadTex = roadTexture();
    roadTex.wrapS = roadTex.wrapT = THREE.RepeatWrapping;
    const roadMat = new THREE.MeshStandardMaterial({ map: roadTex, roughness: 0.9 });
    const roadGeoX = new THREE.PlaneGeometry(H * 2, WORLD.street);
    const roadGeoZ = new THREE.PlaneGeometry(WORLD.street, H * 2);
    for (const r of WORLD.roads) {
      const a = new THREE.Mesh(roadGeoX, roadMat.clone());
      a.material.map = roadTex.clone(); a.material.map.repeat.set(44, 1); a.material.map.needsUpdate = true;
      a.rotation.x = -Math.PI / 2; a.position.set(0, 0.08, r); a.receiveShadow = true; s.add(a);
      const b = new THREE.Mesh(roadGeoZ, roadMat.clone());
      b.material.map = roadTex.clone(); b.material.map.repeat.set(1, 44); b.material.map.needsUpdate = true;
      b.rotation.x = -Math.PI / 2; b.position.set(r, 0.08, 0); b.receiveShadow = true; s.add(b);
    }
    // Beach-strip road along Marina Row.
    const beachRoad = new THREE.Mesh(new THREE.PlaneGeometry(WORLD.street, H * 2), roadMat.clone());
    beachRoad.material.map = roadTex.clone(); beachRoad.material.map.repeat.set(1, 44); beachRoad.material.map.needsUpdate = true;
    beachRoad.rotation.x = -Math.PI / 2; beachRoad.position.set(WORLD.beachX, 0.08, 0); s.add(beachRoad);

    // Sidewalk slabs around each block.
    const walkMat = new THREE.MeshStandardMaterial({ color: PALETTE.sidewalk, roughness: 1 });
    for (let ix = 0; ix < WORLD.roads.length - 1; ix++) {
      for (let iz = 0; iz < WORLD.roads.length - 1; iz++) {
        const x0 = WORLD.roads[ix] + WORLD.street / 2, x1 = WORLD.roads[ix + 1] - WORLD.street / 2;
        const z0 = WORLD.roads[iz] + WORLD.street / 2, z1 = WORLD.roads[iz + 1] - WORLD.street / 2;
        const w = x1 - x0, d = z1 - z0;
        if (w <= 0 || d <= 0) continue;
        const slab = new THREE.Mesh(new THREE.PlaneGeometry(w + 8, d + 8), walkMat);
        slab.rotation.x = -Math.PI / 2; slab.position.set((x0 + x1) / 2, 0.06, (z0 + z1) / 2);
        slab.receiveShadow = true; s.add(slab);
      }
    }

    // Buildings: seeded towers, taller downtown, coral/teal/gold walls.
    const facades = [
      facadeTexture('#c96f5e', '#ffd9a0'), facadeTexture('#4f7fa8', '#bfe6ff'),
      facadeTexture('#7a6a9e', '#ffe08a'), facadeTexture('#5e8a6a', '#d8ffd0'),
      facadeTexture('#a8874f', '#fff0c0'), facadeTexture('#3f4a5e', '#9fd8ff'),
    ];
    const wallColors = [0xc96f5e, 0x4f7fa8, 0x7a6a9e, 0x5e8a6a, 0xa8874f, 0x3f4a5e];
    const boxGeo = new THREE.BoxGeometry(1, 1, 1);
    for (let ix = 0; ix < WORLD.roads.length - 1; ix++) {
      for (let iz = 0; iz < WORLD.roads.length - 1; iz++) {
        const x0 = WORLD.roads[ix] + WORLD.street / 2 + 6, x1 = WORLD.roads[ix + 1] - WORLD.street / 2 - 6;
        const z0 = WORLD.roads[iz] + WORLD.street / 2 + 6, z1 = WORLD.roads[iz + 1] - WORLD.street / 2 - 6;
        const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
        const downtown = Math.abs(cx) < 180 && Math.abs(cz) < 180;
        // Marina Row blocks stay low (boardwalk), Hillside gets villas.
        const marina = cx < -240;
        const n = downtown ? rng.int(2, 4) : marina ? rng.int(0, 1) : rng.int(1, 3);
        for (let k = 0; k < n; k++) {
          const w = rng.range(10, Math.min(20, (x1 - x0) / n));
          const d = rng.range(10, 18);
          const h = downtown ? rng.range(28, 95) : marina ? rng.range(6, 12) : rng.range(10, 34);
          const bx = x0 + ((x1 - x0) / n) * (k + 0.5) + rng.range(-3, 3);
          const bz = cz + rng.range(-8, 8);
          const fi = rng.int(0, facades.length - 1);
          const mat = new THREE.MeshStandardMaterial({
            map: facades[fi], color: wallColors[fi],
            emissive: 0xffc46b, emissiveMap: facades[fi], emissiveIntensity: 0.0,
          });
          const b = new THREE.Mesh(boxGeo, mat);
          b.scale.set(w, h, d); b.position.set(bx, h / 2, bz);
          b.castShadow = true; b.receiveShadow = true; s.add(b);
          // Rooftop rim.
          const rim = new THREE.Mesh(new THREE.BoxGeometry(w + 0.6, 0.8, d + 0.6),
            new THREE.MeshStandardMaterial({ color: 0x2a2f3a, roughness: 0.8 }));
          rim.position.set(bx, h + 0.4, bz); s.add(rim);
          this.buildings.push({ x: bx, z: bz, hw: w / 2 + 0.5, hd: d / 2 + 0.5, h, mat });
        }
      }
    }

    // Palms along the beach, the causeway and random sidewalks.
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x7a5230, roughness: 1 });
    const frondMat = new THREE.MeshStandardMaterial({ color: 0x2f8f4e, roughness: 0.9 });
    const trunkGeo = new THREE.CylinderGeometry(0.35, 0.55, 7, 6);
    const frondGeo = new THREE.ConeGeometry(2.6, 1.1, 5);
    const palmSpots = [];
    for (let z = -300; z <= 300; z += 24) {
      palmSpots.push([-272, z + rng.range(-6, 6)], [-300, z + 12]);
      if (rng.chance(0.5)) palmSpots.push([336 + rng.range(0, 120), rng.chance(0.5) ? -14 : 14]);
    }
    for (let i = 0; i < 90; i++) {
      const bx = rng.pick(WORLD.roads) + rng.range(10, 24) * (rng.chance(0.5) ? 1 : -1);
      const bz = rng.pick(WORLD.roads) + rng.range(10, 24) * (rng.chance(0.5) ? 1 : -1);
      if (Math.abs(bx) < 320 && Math.abs(bz) < 320) palmSpots.push([bx, bz]);
    }
    for (const [px, pz] of palmSpots) {
      if (this.insideBuilding(px, pz, 2)) continue;
      const palm = new THREE.Group();
      const trunk = new THREE.Mesh(trunkGeo, trunkMat);
      trunk.position.y = 3.5; trunk.rotation.z = rng.range(-0.08, 0.08); trunk.castShadow = true;
      palm.add(trunk);
      for (let f = 0; f < 6; f++) {
        const frond = new THREE.Mesh(frondGeo, frondMat);
        const a = (f / 6) * Math.PI * 2 + rng.range(-0.2, 0.2);
        frond.position.set(Math.cos(a) * 1.6, 7.1, Math.sin(a) * 1.6);
        frond.rotation.set(Math.sin(a) * 1.1, 0, -Math.cos(a) * 1.1);
        frond.scale.set(1, 1, 0.35);
        palm.add(frond);
      }
      const crown = new THREE.Mesh(new THREE.SphereGeometry(1.1, 8, 6),
        new THREE.MeshStandardMaterial({ color: 0x3aa655, roughness: 0.9 }));
      crown.position.y = 7.2; palm.add(crown);
      palm.position.set(px, 0, pz);
      s.add(palm); this.palms.push(palm);
    }

    // The Vela Wheel — ferris wheel on Marina Row, lit pink at night.
    const wheel = new THREE.Group();
    const spinner = new THREE.Group();
    wheel.add(spinner);
    const rimMat = new THREE.MeshStandardMaterial({ color: 0xff2e88, emissive: 0xff2e88, emissiveIntensity: 0.7, roughness: 0.4 });
    const rim = new THREE.Mesh(new THREE.TorusGeometry(22, 0.7, 10, 40), rimMat);
    spinner.add(rim);
    const spokeMat = new THREE.MeshStandardMaterial({ color: 0xe8e4da, roughness: 0.5 });
    for (let i = 0; i < 8; i++) {
      const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.6, 44, 0.6), spokeMat);
      spoke.rotation.z = (i / 8) * Math.PI; spinner.add(spoke);
    }
    const cabinMat = new THREE.MeshStandardMaterial({ color: 0xffc93c, emissive: 0xff9e4f, emissiveIntensity: 0.5 });
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const cabin = new THREE.Mesh(new THREE.BoxGeometry(3, 2.4, 2.4), cabinMat);
      cabin.position.set(Math.cos(a) * 22, Math.sin(a) * 22, 0);
      cabin.userData.angle = a;
      spinner.add(cabin); this.wheelLights.push(cabin);
    }
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(2, 2, 3, 12), spokeMat);
    hub.rotation.x = Math.PI / 2; spinner.add(hub);
    const legMat = new THREE.MeshStandardMaterial({ color: 0x2a2f3a, roughness: 0.7 });
    for (const side of [-1, 1]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(1.4, 30, 1.4), legMat);
      leg.position.set(0, -12, side * 5); leg.rotation.z = side * 0.35; wheel.add(leg);
    }
    wheel.position.set(-308, 26, -120); // on the sand, west of the beach road, facing it
    s.add(wheel); this.wheel = wheel; this.wheelSpinner = spinner;

    // Palm Causeway: bridge deck east from the city to the lighthouse islet.
    const deckMat = new THREE.MeshStandardMaterial({ color: 0x6a6f78, roughness: 0.9 });
    const deck = new THREE.Mesh(new THREE.BoxGeometry(150, 1.2, 14), deckMat);
    deck.position.set(400, -0.5, 0); deck.castShadow = true; deck.receiveShadow = true; s.add(deck);
    const railMat = new THREE.MeshStandardMaterial({ color: 0xffc93c, emissive: 0xff9e4f, emissiveIntensity: 0.35 });
    for (const side of [-7.4, 7.4]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(150, 1, 0.5), railMat);
      rail.position.set(400, 1.0, side); s.add(rail);
    }
    for (let x = 340; x <= 465; x += 25) {
      const pier = new THREE.Mesh(new THREE.BoxGeometry(3, 4, 10), deckMat);
      pier.position.set(x, -1, 0); s.add(pier);
    }
    // Islet rock + lighthouse. The rock is low (top near y = 0) so a car can
    // drive onto the islet and stay visible — a tall rock would swallow it.
    const rock = new THREE.Mesh(new THREE.CylinderGeometry(58, 66, 1.5, 24),
      new THREE.MeshStandardMaterial({ color: 0x8a7f6a, roughness: 1 }));
    rock.position.set(470, -0.5, 0); rock.receiveShadow = true; s.add(rock);
    const tower = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 4.2, 26, 12),
      new THREE.MeshStandardMaterial({ color: 0xf2ead8, roughness: 0.7 }));
    tower.position.set(470, 13, 0); tower.castShadow = true; s.add(tower);
    const lampRoom = new THREE.Mesh(new THREE.CylinderGeometry(3.6, 3.6, 4, 12),
      new THREE.MeshStandardMaterial({ color: 0x11151c, emissive: 0xffe08a, emissiveIntensity: 1.2 }));
    lampRoom.position.set(470, 28, 0); s.add(lampRoom); this.wheelLights.push(lampRoom);
    const cap = new THREE.Mesh(new THREE.ConeGeometry(4.4, 3.4, 12),
      new THREE.MeshStandardMaterial({ color: 0xc23b3b, roughness: 0.6 }));
    cap.position.set(470, 31.5, 0); s.add(cap);

    // Old Harbor warehouses + containers near the south docks.
    const contColors = [0xc23b3b, 0x2e7f9e, 0xd8a03c, 0x4f9e5e];
    for (let i = 0; i < 26; i++) {
      const cx = rng.range(-200, 200), cz = rng.range(255, 315);
      if (this.insideBuilding(cx, cz, 4)) continue;
      const c = new THREE.Mesh(new THREE.BoxGeometry(10, 3.4, 3.4),
        new THREE.MeshStandardMaterial({ color: contColors[i % 4], roughness: 0.8 }));
      c.position.set(cx, 1.7, cz); c.rotation.y = rng.chance(0.5) ? 0 : Math.PI / 2;
      c.castShadow = true; s.add(c);
      this.buildings.push({ x: cx, z: cz, hw: 5.4, hd: 5.4, h: 3.4, mat: null });
    }

    // Street lamps along the main avenues (emissive at night).
    const lampGeo = new THREE.CylinderGeometry(0.18, 0.22, 7, 6);
    const lampMat = new THREE.MeshStandardMaterial({ color: 0x22262e, roughness: 0.7 });
    const bulbGeo = new THREE.SphereGeometry(0.55, 8, 6);
    for (const r of WORLD.roads) {
      for (let p = -270; p <= 270; p += 60) {
        if (Math.abs(p) < 8) continue;
        const pole = new THREE.Mesh(lampGeo, lampMat);
        pole.position.set(p, 3.5, r + 7); s.add(pole);
        const bulbMat = new THREE.MeshStandardMaterial({ color: 0xfff2c0, emissive: 0xffdf80, emissiveIntensity: 0.0 });
        const bulb = new THREE.Mesh(bulbGeo, bulbMat);
        bulb.position.set(p, 7.2, r + 7); s.add(bulb);
        this.streetLights.push(bulbMat);
      }
    }
    // Neon signs on Marina Row.
    const neonCols = [0xff2e88, 0x00e5ff, 0xffc93c];
    for (let i = 0; i < 10; i++) {
      const z = -260 + i * 56;
      const sign = new THREE.Mesh(new THREE.BoxGeometry(0.6, 3.2, 8),
        new THREE.MeshStandardMaterial({ color: 0x11151c, emissive: neonCols[i % 3], emissiveIntensity: 1.4 }));
      sign.position.set(-252, 9, z); s.add(sign);
    }
  }

  insideBuilding(x, z, pad) {
    for (const b of this.buildings) {
      if (Math.abs(x - b.x) < b.hw + pad && Math.abs(z - b.z) < b.hd + pad) return true;
    }
    return false;
  }

  // Push a circle (radius r) out of every building AABB it overlaps.
  collideCircle(x, z, r) {
    let nx = x, nz = z;
    for (const b of this.buildings) {
      const cx = clamp(x, b.x - b.hw, b.x + b.hw);
      const cz = clamp(z, b.z - b.hd, b.z + b.hd);
      const dx = x - cx, dz = z - cz;
      const d2 = dx * dx + dz * dz;
      if (d2 < r * r && d2 > 0.0001) {
        const d = Math.sqrt(d2);
        nx = cx + (dx / d) * r; nz = cz + (dz / d) * r;
      } else if (d2 <= 0.0001) {
        // Centre inside the box: push out along the smallest penetration axis.
        const px = b.hw + r - Math.abs(x - b.x), pz = b.hd + r - Math.abs(z - b.z);
        if (px < pz) nx = b.x + (x >= b.x ? b.hw + r : -b.hw - r);
        else nz = b.z + (z >= b.z ? b.hd + r : -b.hd - r);
      }
    }
    return { x: nx, z: nz };
  }

  isOnRoad(x, z) {
    if (Math.abs(z) <= WORLD.street / 2 + 1 && x >= 330 && x <= 475) return true; // causeway
    if (Math.abs(x - WORLD.beachX) <= WORLD.street / 2 + 1) return true;
    for (const r of WORLD.roads) {
      if (Math.abs(x - r) <= WORLD.street / 2 + 1 || Math.abs(z - r) <= WORLD.street / 2 + 1) return true;
    }
    return false;
  }

  // Nearest point on the road network (used to keep traffic on tarmac).
  nearestRoadPoint(x, z) {
    let best = null, bd = Infinity;
    const consider = (px, pz) => {
      const d = (px - x) ** 2 + (pz - z) ** 2;
      if (d < bd) { bd = d; best = { x: px, z: pz }; }
    };
    for (const r of WORLD.roads) {
      consider(clamp(x, -WORLD.half, WORLD.half), r);
      consider(r, clamp(z, -WORLD.half, WORLD.half));
    }
    consider(WORLD.beachX, clamp(z, -WORLD.half, WORLD.half));
    consider(clamp(x, 330, 475), 0);
    return best;
  }

  // Night glow: window emissive + lamps + wheel brightness follow darkness 0..1.
  setNight(dark) {
    for (const b of this.buildings) if (b.mat) b.mat.emissiveIntensity = dark * 0.85;
    for (const m of this.streetLights) m.emissiveIntensity = dark * 1.6;
    for (const c of this.wheelLights) c.material.emissiveIntensity = 0.4 + dark * 1.4;
  }

  update(dt, time) {
    if (this.wheelSpinner) {
      this.wheelSpinner.rotation.z += dt * 0.12;
      // Cabins stay upright while the wheel turns.
      for (const child of this.wheelSpinner.children) {
        if (child.userData.angle !== undefined) child.rotation.z = -this.wheelSpinner.rotation.z;
      }
    }
  }
}
