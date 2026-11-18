// Vela Bay — boot and the one loop. Fixed 1/60 s steps, input every frame,
// the city, traffic, pedestrians, police, missions, combat, radio and the
// HUD all advancing together. ?shot=chase|city|mission|night stages a
// screenshot scene instead of the menu; ?seed=N fixes the world.
import * as THREE from 'three';
import { WORLD, MISSIONS, VEHICLES, WEAPONS, RADIO, CREW, DAY_LENGTH_S, START_MONEY, districtAt } from './config.js';
import { makeRng, clamp, dist2d, fmtMoney } from './random.js';
import { Input } from './input.js';
import { City } from './city.js';
import { PlayerCar, buildPersonMesh } from './vehicles.js';
import { Traffic } from './traffic.js';
import { Pedestrians } from './pedestrians.js';
import { Police } from './police.js';
import { Combat } from './combat.js';
import { Missions, dialogueFor } from './missions.js';
import { Hud } from './hud.js';
import { AudioEngine } from './audio.js';
import { loadSave, writeSave, defaultSave } from './save.js';
import { Render } from './render.js';
import { stageShot } from './shots.js';

const STEP = 1 / 60;
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shotName = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : (Math.floor(Math.random() * 4294967296) >>> 0);

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.input = new Input(canvas);
    this.render = new Render(canvas);
    this.scene = this.render.scene;
    this.city = new City(this.scene, seed);
    this.traffic = new Traffic(this.scene, this.city, seed);
    this.peds = new Pedestrians(this.scene, this.city, seed);
    this.police = new Police(this.scene, this.city, seed);
    this.combat = new Combat(this.scene);
    this.missions = new Missions(this.scene);
    this.hud = new Hud();
    this.audio = new AudioEngine();
    this.saved = loadSave() || defaultSave();
    this.state = {
      money: this.saved.money, rep: this.saved.rep, score: this.saved.score,
      wanted: 0, crimeTimer: 0, health: 100, armor: 50,
      day: this.saved.day, clock: this.saved.clock,
      inCar: true, carKind: this.saved.carKind, autopilot: false,
      screen: 'menu', time: 0, nearMissCooldown: 0, driftScoreT: 0,
      saveTimer: 0, bustedTimer: 0, radioStation: this.saved.station ?? 0,
    };
    this.car = null;
    this.person = null;
    this.px = this.saved.x || 0; this.pz = this.saved.z || 0; this.pHeading = this.saved.heading || 0;
    this.missions.onEvent = (ev, data) => this.onMissionEvent(ev, data);
    this.hud.onStart = () => this.startGame();
    this.hud.onResume = () => this.setScreen('play');
    this.hud.onSave = () => { this.saveNow(); this.hud.toast('Game saved — see you soon, Dario.'); };
    this.policeUnits = [];
    this.heliOn = false;
    this.resetWorld();
  }

  resetWorld() {
    // Fresh player: pink Comet GT on the Downtown grid, on foot figure ready.
    if (this.car) this.scene.remove(this.car.mesh);
    if (this.person) this.scene.remove(this.person);
    this.car = new PlayerCar(this.scene, this.state.carKind, this.px, this.pz, this.pHeading);
    this.person = buildPersonMesh(0xff2e63);
    this.person.visible = false;
    this.scene.add(this.person);
    this.state.inCar = true;
    this.state.health = 100;
    this.render.snapBehind(this.pHeading);
  }

  placePlayerInCar(kind, x, z, heading) {
    if (this.car) this.scene.remove(this.car.mesh);
    this.state.carKind = kind;
    this.car = new PlayerCar(this.scene, kind, x, z, heading);
    this.car.speed = 22;
    this.person.visible = false;
    this.state.inCar = true;
    this.px = x; this.pz = z; this.pHeading = heading;
    this.render.snapBehind(heading);
  }

  placePlayerOnFoot(x, z, heading) {
    if (this.car) { this.car.mesh.visible = false; }
    this.person.visible = true;
    this.person.position.set(x, 0, z);
    this.person.rotation.y = heading;
    this.state.inCar = false;
    this.px = x; this.pz = z; this.pHeading = heading;
    this.render.snapBehind(heading);
  }

  // --- wanted level -------------------------------------------------------
  addWanted(n, reason) {
    const before = this.state.wanted;
    this.state.wanted = clamp(this.state.wanted + n, 0, 5);
    this.state.crimeTimer = 25;
    if (this.state.wanted > before) {
      this.hud.popup(`WANTED ${'★'.repeat(this.state.wanted)}`, 'wanted');
      if (reason) this.hud.toast(reason);
    }
  }

  // --- missions -----------------------------------------------------------
  onMissionEvent(ev, data) {
    if (ev === 'start') {
      const d = dialogueFor(data.mission, 0);
      this.hud.showDialogue(d.name, d.role, d.color, d.initials, data.mission.brief, 7000);
      this.hud.toast(`JOB ${data.mission.id} · ${data.mission.name.toUpperCase()} — ${fmtMoney(data.mission.reward)} + ${data.mission.rep} REP`);
      this.audio.blip(660, 0.15, 'triangle', 0.12);
    } else if (ev === 'stage') {
      const d = dialogueFor(data.mission, data.stage);
      this.hud.showDialogue(d.name, d.role, d.color, d.initials, d.line);
      this.audio.pickup();
      this.state.score += 100;
      this.hud.popup('+100 STAGE CLEAR', 'score');
    } else if (ev === 'complete') {
      const m = data.mission;
      this.state.money += m.reward;
      this.state.rep += m.rep;
      this.state.score += m.reward;
      this.hud.toast(`JOB COMPLETE — ${m.name.toUpperCase()} · +${fmtMoney(m.reward)} · +${m.rep} REP`);
      this.hud.popup(`+${fmtMoney(m.reward)}`, 'score');
      this.audio.missionComplete();
      this.saveNow();
      if (this.missions.done) {
        this.hud.showDialogue('Mara Kade', 'Fixer', '#ff2e88', 'MK',
          'Eight jobs. Clean slate, Dario. Vela Bay is yours now — do not waste it.', 8000);
      }
    }
  }

  saveNow() {
    const s = {
      version: 1, money: this.state.money, rep: this.state.rep, score: this.state.score,
      missionIndex: this.missions.index, completed: this.missions.completedCount,
      day: this.state.day, clock: this.state.clock, carKind: this.state.carKind,
      x: this.px, z: this.pz, heading: this.pHeading,
      ammo: this.combat.ammo, station: this.audio.station,
    };
    writeSave(s);
  }

  startGame() {
    this.audio.ensure();
    this.setScreen('play');
    if (!this.missions.active && !this.missions.done) {
      this.missions.start();
    } else {
      this.hud.showDialogue('Mara Kade', 'Fixer', '#ff2e88', 'MK',
        'Back on the grid. Drive like you mean it.', 4000);
    }
  }

  setScreen(screen) {
    this.state.screen = screen;
    this.hud.showMenu(screen === 'menu');
    this.hud.showPause(screen === 'pause');
    this.hud.showHud(screen === 'play');
    if (screen === 'play') this.audio.ensure();
  }

  // --- one fixed step -----------------------------------------------------
  stepFixed(dt, drive) {
    const st = this.state;
    st.time += dt;
    st.clock += dt * (86400 / DAY_LENGTH_S);
    if (st.clock >= 86400) { st.clock -= 86400; st.day += 1; }
    const dark = this.render.setTimeOfDay(st.clock, this.city);
    this.city.update(dt, st.time);

    const input = this.input;
    const axes = drive || input.driveAxes();
    const mouse = input.consumeMouse();

    // --- player -----------------------------------------------------------
    let speedKmh = 0;
    if (st.inCar && this.car) {
      const others = [...this.traffic.cars, ...this.police.cars];
      const ev = this.car.step(dt, axes.throttle, axes.steer, axes.handbrake, this.city, others);
      this.px = this.car.x; this.pz = this.car.z; this.pHeading = this.car.heading;
      speedKmh = this.car.speedKmh;
      if (ev.crashed > 0) { this.audio.crash(ev.crashed); this.addWanted(0); }
      if (ev.nearMiss && st.nearMissCooldown <= 0) {
        st.nearMissCooldown = 2; st.score += 150;
        this.hud.popup('NEAR MISS +150', 'score'); this.audio.blip(1200, 0.1, 'sine', 0.08);
      }
      if (this.car.drift > 0.4 && Math.abs(this.car.speed) > 15) {
        st.driftScoreT += dt;
        st.score += Math.floor(dt * 12);
        if (st.driftScoreT > 2) { st.driftScoreT = 0; this.hud.popup('DRIFT +25', 'score'); }
      }
      // Car vs pedestrian.
      const ped = this.peds.nearest(this.px, this.pz, 2.0);
      if (ped && Math.abs(this.car.speed) > 5) {
        this.peds.hit(ped, 200);
        this.addWanted(1, 'Hit and run — the VPD saw that.');
        this.audio.crash(8);
      }
      // Wrecked?
      if (this.car.damage >= 100) {
        this.hud.toast('CAR WRECKED — you are on foot now.');
        this.audio.crash(20);
        this.placePlayerOnFoot(this.px + 3, this.pz + 3, this.pHeading);
        this.scene.remove(this.car.mesh); this.car = null;
      }
    } else {
      // On foot.
      const mv = input.moveAxes();
      const speed = mv.run ? 8.5 : 4.6;
      const camYaw = this.render.camYaw;
      const fx = Math.sin(camYaw), fz = Math.cos(camYaw);
      const rx = Math.cos(camYaw), rz = -Math.sin(camYaw);
      let mx = fx * -mv.z + rx * mv.x;
      let mz = fz * -mv.z + rz * mv.x;
      const len = Math.hypot(mx, mz);
      if (len > 0.01) {
        mx /= len; mz /= len;
        this.px += mx * speed * dt; this.pz += mz * speed * dt;
        this.pHeading = Math.atan2(mx, mz);
        this.person.userData.legs[0].rotation.x = Math.sin(st.time * 11) * 0.6;
        this.person.userData.legs[1].rotation.x = -Math.sin(st.time * 11) * 0.6;
      }
      const pushed = this.city.collideCircle(this.px, this.pz, 0.5);
      this.px = clamp(pushed.x, -320, 520); this.pz = clamp(pushed.z, -320, 320);
      this.person.position.set(this.px, 0, this.pz);
      this.person.rotation.y = this.pHeading;
      speedKmh = len > 0.01 ? speed * 3.6 : 0;
      // Traffic can knock the player down.
      const car = this.traffic.nearest(this.px, this.pz, 2.2);
      if (car && car.speed > 5) {
        st.health -= 20; this.addWanted(0);
        this.hud.popup('HIT BY TRAFFIC −20 HP', 'wanted');
        this.px += Math.sin(this.pHeading) * 2; this.pz += Math.cos(this.pHeading) * 2;
      }
      // Police contact on foot hurts.
      const cop = this.police.cars[0];
      if (cop && Math.hypot(cop.x - this.px, cop.z - this.pz) < 3) {
        st.health -= 25 * dt; st.bustedTimer += dt;
      } else st.bustedTimer = 0;
    }
    if (st.nearMissCooldown > 0) st.nearMissCooldown -= dt;

    // Busted: health gone — the VPD takes a cut and drops Dario at the harbor.
    if (st.health <= 0) {
      const fine = Math.min(100, st.money);
      st.money -= fine; st.wanted = 0; st.health = 100; st.armor = 50;
      this.hud.toast(`BUSTED — the VPD took ${fmtMoney(fine)} and dropped you at Old Harbor.`);
      this.hud.showDialogue('Mara Kade', 'Fixer', '#ff2e88', 'MK', 'You owe me a bail story. Get back in the car.', 5000);
      if (!st.inCar) { /* stay on foot */ } else { this.placePlayerOnFoot(0, 240, 0); }
      this.px = 0; this.pz = 240;
      if (this.car) this.car.damage = Math.min(60, this.car.damage);
    }

    // --- world ------------------------------------------------------------
    this.traffic.update(dt, { x: this.px, z: this.pz }, speedKmh);
    this.peds.update(dt, { x: this.px, z: this.pz }, speedKmh, st.wanted > 0);
    this.policeUnits = this.police.update(dt, st.wanted, { x: this.px, z: this.pz }, this.pHeading, speedKmh, dark > 0.5);
    this.heliOn = !!this.police.heli;
    this.missions.update(dt, st.time);
    this.combat.update(dt);
    this.combat.updateTracers(dt);

    // Wanted decay: lay low, lose the tail, cool off one star at a time.
    if (st.wanted > 0) {
      if (st.crimeTimer > 0) st.crimeTimer -= dt;
      else if (this.police.nearestDist() > 60) {
        st.wanted -= 1; st.crimeTimer = 25;
        this.hud.toast(st.wanted === 0 ? 'Clean — the heat is off.' : `Heat dropping — ${st.wanted} star${st.wanted === 1 ? '' : 's'} left.`);
      }
    }

    // Mission progress.
    const reached = this.missions.checkReached(this.px, this.pz);
    if (reached && reached.complete) {
      // next job waits for M — the island breathes for a second.
    }

    // Camera.
    const camTarget = st.inCar && this.car
      ? { x: this.car.x, y: 1.2, z: this.car.z, heading: this.car.heading }
      : { x: this.px, y: 1.4, z: this.pz, heading: this.pHeading };
    this.render.follow(dt, camTarget.x, camTarget.y, camTarget.z, camTarget.heading, mouse.dx, mouse.dy, st.inCar);

    // Audio follows the drive.
    this.audio.setEngine(speedKmh, st.inCar);
    this.audio.setSiren(st.wanted > 0, st.wanted);

    // Autosave.
    st.saveTimer += dt;
    if (st.saveTimer > 30) { st.saveTimer = 0; this.saveNow(); }

    this._speedKmh = speedKmh;
    this._dark = dark;
  }

  // --- interactions (edge-triggered keys) ---------------------------------
  handleKeys() {
    const input = this.input;
    const st = this.state;
    if (st.screen !== 'play') return;
    if (input.pressed('KeyP') || input.pressed('Escape')) { this.setScreen('pause'); return; }
    if (input.pressed('KeyM')) {
      if (!this.missions.active && !this.missions.done) this.missions.start();
      else if (this.missions.active) this.hud.toast(`JOB ${this.missions.mission.id} · ${this.missions.mission.name} — follow the yellow marker.`);
    }
    if (input.pressed('KeyR')) {
      const s = this.audio.nextStation();
      this.hud.toast(`${s.name} — ${s.genre}`);
    }
    if (input.pressed('Digit1') || input.pressed('Digit2') || input.pressed('Digit3')) {
      this.combat.select(input.pressed('Digit1') ? 'Digit1' : input.pressed('Digit2') ? 'Digit2' : 'Digit3');
    }
    if (input.pressed('KeyF')) this.toggleCar();
    if (input.pressed('KeyE')) this.trySteal();
    // Shooting: click (or hold for the SMG).
    const wantFire = input.mouseClicked || (input.mouseDown && this.combat.def.auto);
    if (wantFire && !st.inCar) {
      const res = this.combat.fire(this.render.camera, { peds: this.peds, police: this.police, traffic: this.traffic });
      if (res) {
        if (res.empty) { this.hud.toast('Out of ammo — find more or use your fists.'); }
        else if (res.hit) {
          this.audio.shot();
          if (res.hit === 'ped') {
            this.addWanted(res.killed ? 2 : 1, res.killed ? 'A bystander is down — the whole island heard that.' : 'Shots fired in public.');
            if (res.killed) { st.score = Math.max(0, st.score - 50); this.hud.popup('−50', 'wanted'); }
          } else if (res.hit === 'police') {
            this.addWanted(1, 'You shot at the VPD. Bold. Stupid, but bold.');
          }
        } else if (this.combat.weapon !== 'fists') this.audio.shot();
      }
    }
  }

  toggleCar() {
    const st = this.state;
    if (st.inCar && this.car) {
      // Step out: the car stays parked where it is.
      const x = this.car.x + Math.sin(this.car.heading + Math.PI / 2) * 2.5;
      const z = this.car.z + Math.cos(this.car.heading + Math.PI / 2) * 2.5;
      this.placePlayerOnFoot(x, z, this.car.heading);
    } else if (!st.inCar && this.car) {
      const d = dist2d(this.px, this.pz, this.car.x, this.car.z);
      if (d < 5) {
        this.person.visible = false;
        st.inCar = true;
        this.render.snapBehind(this.car.heading);
        this.audio.blip(440, 0.08, 'sine', 0.08);
      } else {
        this.hud.toast('No car close enough — walk to your Comet or steal one (E).');
      }
    }
  }

  trySteal() {
    const st = this.state;
    if (st.inCar) return;
    const car = this.traffic.nearest(this.px, this.pz, 5);
    if (!car) { this.hud.toast('No car in reach — get closer and press E.'); return; }
    const kind = car.kind;
    this.traffic.remove(car);
    this.traffic.panicAll();
    this.peds.update(0, { x: this.px, z: this.pz }, 0, true);
    this.placePlayerInCar(kind, car.x, car.z, car.heading);
    this.addWanted(1, `Stole a ${VEHICLES[kind].name} — the owner called it in.`);
    st.score += 50;
    this.hud.popup('CAR STOLEN +50', 'score');
    this.audio.blip(520, 0.1, 'square', 0.1);
  }

  // --- HUD snapshot -------------------------------------------------------
  hudState() {
    const st = this.state;
    const m = this.missions.active ? this.missions.mission : null;
    const sd = this.missions.stageDef;
    const obj = this.missions.nextObjectiveText();
    const objectives = typeof obj === 'string' ? { current: obj, next: '' } : obj;
    const target = sd ? { x: sd.x, z: sd.z } : null;
    const targetDist = target ? dist2d(this.px, this.pz, target.x, target.z) : 0;
    const nearCar = !st.inCar && this.car ? this.traffic.nearest(this.px, this.pz, 5) : null;
    const nearOwn = !st.inCar && this.car && dist2d(this.px, this.pz, this.car.x, this.car.z) < 5;
    return {
      mission: m, stage: this.missions.stage, objectives, target, targetDist,
      district: districtAt(this.px, this.pz), completed: this.missions.completedCount,
      nextJob: this.missions.done ? 'All jobs done' : `Next: ${MISSIONS[this.missions.index].name}`,
      wanted: st.wanted, money: st.money, day: st.day, clock: st.clock,
      rep: st.rep, score: st.score, health: Math.max(0, Math.round(st.health)), armor: Math.round(st.armor),
      policeUnits: this.police.cars.map((c) => ({ name: c.name, state: c.state, dist: c.dist ?? 0, pos: { x: c.x, z: c.z } })),
      heli: this.heliOn,
      weapon: this.combat.weapon, ammo: this.combat.ammo,
      speedKmh: st.inCar && this.car ? this.car.speedKmh : (this._speedKmh || 0),
      carName: this.car ? VEHICLES[this.car.kind].name : 'ON FOOT',
      carDamage: this.car ? Math.round(this.car.damage) : 0,
      drifting: this.car ? this.car.drift > 0.4 : false,
      radioStation: RADIO[this.audio.station].name,
      radioTrack: this.audio.trackName,
      showCrosshair: !st.inCar && this.combat.weapon !== 'fists',
      prompt: st.inCar ? '' : nearOwn ? 'F — GET IN YOUR CAR' : nearCar ? 'E — STEAL CAR' : '',
      x: this.px, z: this.pz, heading: this.pHeading,
    };
  }

  // --- the loop -----------------------------------------------------------
  run() {
    let last = performance.now();
    let acc = 0;
    let frozenDraws = 0;
    const frame = (now) => {
      requestAnimationFrame(frame);
      acc += Math.min((now - last) / 1000, MAX_FRAME);
      last = now;
      if (this.state.screen === 'play' || this.state.screen === 'menu') {
        this.handleKeys();
        // Shot mode freezes the simulation after staging: the screenshot is the
        // staged frame, not a coasting car minutes later.
        if (!this.state.shotFrozen) {
          while (acc >= STEP) { this.stepFixed(STEP, null); acc -= STEP; }
        } else acc = 0;
        if (this.state.screen === 'play') this.hud.update(this.hudState());
      } else {
        acc = 0;
      }
      // Frozen frame: present it a few times, then stop paying SwiftShader for
      // identical frames — the compositor keeps the last one for the screenshot.
      if (this.state.shotFrozen) {
        if (frozenDraws < 3) { this.render.draw(); frozenDraws += 1; }
      } else this.render.draw();
      this.input.endFrame();
    };
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.state.screen === 'play') this.setScreen('pause');
    });
    this.setScreen(shotName ? 'play' : 'menu');
    if (shotName) {
      stageShot(shotName, this);
      this.state.shotFrozen = true;
      this.hud.showHud(true);
      this.hud.showMenu(false);
    } else {
      this.hud.showHud(false);
    }
    requestAnimationFrame(frame);
  }
}

const game = new Game(document.getElementById('game'));
game.run();
