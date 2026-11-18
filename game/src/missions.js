// The story: eight jobs for Dario Venn and his crew. A mission is a chain of
// "get to the marker" stages; reaching one advances the story, shows the next
// line of dialogue, and pays money + rep at the end. A 3D beacon marks the
// current target in the world and on the minimap.
import * as THREE from 'three';
import { MISSIONS, CREW } from './config.js';
import { dist2d } from './random.js';

export class Missions {
  constructor(scene) {
    this.scene = scene;
    this.index = 0;        // mission 0..7 (8 = all done)
    this.stage = 0;
    this.active = false;
    this.completedCount = 0;
    this.beacon = null;
    this.onEvent = null;   // (event, data) -> game: 'stage' | 'complete' | 'start'
    this.marker = this.makeMarker();
    scene.add(this.marker);
    this.marker.visible = false;
  }

  makeMarker() {
    const g = new THREE.Group();
    const cyl = new THREE.Mesh(
      new THREE.CylinderGeometry(2.2, 2.2, 26, 20, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xffc93c, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false }));
    cyl.position.y = 13; g.add(cyl);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(2.6, 0.28, 8, 28),
      new THREE.MeshBasicMaterial({ color: 0xffc93c }));
    ring.rotation.x = Math.PI / 2; ring.position.y = 0.3; g.add(ring);
    const arrow = new THREE.Mesh(new THREE.ConeGeometry(1.1, 2.6, 4),
      new THREE.MeshBasicMaterial({ color: 0xff2e88 }));
    arrow.rotation.x = Math.PI; arrow.position.y = 8; g.add(arrow);
    g.userData.arrow = arrow;
    return g;
  }

  get mission() { return MISSIONS[this.index] || null; }
  get stageDef() { return this.mission ? this.mission.stages[this.stage] : null; }
  get done() { return this.index >= MISSIONS.length; }

  start(index = this.index) {
    if (index >= MISSIONS.length) return false;
    this.index = index; this.stage = 0; this.active = true;
    this.placeMarker();
    this.onEvent?.('start', { mission: this.mission });
    return true;
  }

  placeMarker() {
    const s = this.stageDef;
    if (!s) { this.marker.visible = false; return; }
    this.marker.position.set(s.x, 0, s.z);
    this.marker.visible = true;
  }

  // Returns the stage the player just reached, or null.
  checkReached(x, z) {
    if (!this.active || !this.stageDef) return null;
    if (dist2d(x, z, this.stageDef.x, this.stageDef.z) < 9) {
      this.stage += 1;
      if (this.stage >= this.mission.stages.length) {
        const m = this.mission;
        this.active = false;
        this.marker.visible = false;
        this.completedCount += 1;
        this.index += 1;
        this.onEvent?.('complete', { mission: m });
        return { complete: m };
      }
      this.placeMarker();
      this.onEvent?.('stage', { mission: this.mission, stage: this.stage });
      return { stage: this.stage };
    }
    return null;
  }

  nextObjectiveText() {
    if (this.done) return 'All eight jobs done — Vela Bay is yours, Dario.';
    if (!this.active) return `Next job: ${this.mission.name} — press M to start`;
    const s = this.stageDef;
    const next = this.mission.stages[this.stage + 1];
    return { current: s.text, next: next ? next.text : 'Finish the job' };
  }

  update(dt, time) {
    if (this.marker.visible) {
      this.marker.rotation.y += dt * 1.4;
      this.marker.userData.arrow.position.y = 8 + Math.sin(time * 2.4) * 0.8;
    }
  }
}

export function dialogueFor(mission, stage) {
  const crew = CREW[mission.giver];
  const lines = crew ? crew.lines : [];
  const line = lines[stage % lines.length] || '';
  return { name: mission.giver, role: crew?.role ?? 'Crew', color: crew?.color ?? '#ff2e88', initials: crew?.initials ?? '??', line };
}
