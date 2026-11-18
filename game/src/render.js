// Rendering only: the Three.js renderer, the chase camera, the sun/moon and
// the sky. The camera follows the player from behind (or over the shoulder
// on foot) and eases toward the mouse orbit angle; day and night come from
// the game clock — sunset orange at 18:30, deep blue at night.
import * as THREE from 'three';
import { clamp, lerp, angleLerp } from './random.js';

const SKY = {
  day:    { top: 0x7ec8e3, fog: 0xa8d8e8, sun: 0xfff2d0, sunI: 2.6, hemi: 0.9 },
  sunset: { top: 0xff9e6b, fog: 0xffb08a, sun: 0xff8c42, sunI: 2.2, hemi: 0.75 },
  night:  { top: 0x0b1026, fog: 0x141a33, sun: 0x8fa8ff, sunI: 0.35, hemi: 0.22 },
};

export class Render {
  constructor(canvas) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(SKY.day.top);
    this.scene.fog = new THREE.Fog(SKY.day.fog, 120, 700);
    this.camera = new THREE.PerspectiveCamera(62, 1, 0.1, 1600);
    this.sun = new THREE.DirectionalLight(0xfff2d0, 2.6);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.camera.left = -90; this.sun.shadow.camera.right = 90;
    this.sun.shadow.camera.top = 90; this.sun.shadow.camera.bottom = -90;
    this.sun.shadow.camera.far = 400;
    this.scene.add(this.sun);
    this.hemi = new THREE.HemisphereLight(0xbfd9ff, 0x3a2f28, 0.9);
    this.scene.add(this.hemi);
    this.camYaw = 0; this.camPitch = 0.32; this.camDist = 11;
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  // clockSeconds: seconds since midnight. Returns darkness 0 (noon) .. 1 (night).
  setTimeOfDay(clockSeconds, city) {
    const h = (clockSeconds / 3600) % 24;
    // Daylight factor: 1 at noon, 0 at midnight; sunset band 17.5–19.5.
    const dayF = clamp(Math.sin(((h - 6) / 12) * Math.PI), 0, 1);
    const sunsetF = clamp(1 - Math.abs(h - 18.5) / 1.6, 0, 1);
    const dark = 1 - dayF;
    const pick = (a, b, c) => lerp(lerp(a, b, sunsetF), c, dark * (1 - sunsetF));
    const top = new THREE.Color().setHex(SKY.day.top).lerp(new THREE.Color(SKY.sunset.top), sunsetF).lerp(new THREE.Color(SKY.night.top), dark * (1 - sunsetF));
    const fog = new THREE.Color().setHex(SKY.day.fog).lerp(new THREE.Color(SKY.sunset.fog), sunsetF).lerp(new THREE.Color(SKY.night.fog), dark * (1 - sunsetF));
    this.scene.background.copy(top);
    this.scene.fog.color.copy(fog);
    this.sun.color.setHex(SKY.day.sun).lerp(new THREE.Color(SKY.sunset.sun), sunsetF).lerp(new THREE.Color(SKY.night.sun), dark);
    this.sun.intensity = pick(SKY.day.sunI, SKY.sunset.sunI, SKY.night.sunI);
    this.hemi.intensity = pick(SKY.day.hemi, SKY.sunset.hemi, SKY.night.hemi);
    // Sun swings across the sky; low and orange at sunset, gone at night.
    const sunAngle = ((h - 6) / 12) * Math.PI;
    this.sun.position.set(Math.cos(sunAngle) * 180, Math.max(18, Math.sin(sunAngle) * 160), 120);
    this.sun.target.position.set(0, 0, 0);
    if (city) city.setNight(dark);
    return dark;
  }

  // Chase camera: behind the heading, pulled in by buildings is skipped for
  // simplicity (the city is open enough), eased so it never snaps.
  follow(dt, targetX, targetY, targetZ, heading, mouseDX, mouseDY, inCar) {
    this.camYaw -= mouseDX * 0.0032;
    this.camPitch = clamp(this.camPitch + mouseDY * 0.0022, 0.08, 0.9);
    // Ease the orbit back behind the direction of travel.
    let diff = heading - this.camYaw;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    this.camYaw += diff * Math.min(1, dt * (inCar ? 2.2 : 4));
    const dist = inCar ? 11 : 7.5;
    const height = inCar ? 3.9 : 3.2;
    // Chase cam sits slightly to the car's left flank, so the sunset lights the
    // paint instead of the camera staring at the shadowed rear.
    const lat = inCar ? 2.0 : 0;
    const lx = Math.cos(heading) * lat, lz = -Math.sin(heading) * lat;
    const cx = targetX - Math.sin(this.camYaw) * dist * Math.cos(this.camPitch) + lx;
    const cz = targetZ - Math.cos(this.camYaw) * dist * Math.cos(this.camPitch) + lz;
    const cy = targetY + height + Math.sin(this.camPitch) * dist * 0.55;
    this.camera.position.set(cx, cy, cz);
    this.camera.lookAt(targetX + Math.sin(heading) * 4, targetY + 1.6, targetZ + Math.cos(heading) * 4);
    return { x: cx, y: cy, z: cz };
  }

  snapBehind(heading) { this.camYaw = heading; }

  draw() { this.renderer.render(this.scene, this.camera); }
}
