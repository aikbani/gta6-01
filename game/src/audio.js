// Sound, all synthesized with WebAudio — no audio files. A low engine hum
// that follows speed, three radio stations that play seeded synth melodies,
// a two-tone police siren, and one-shot effects for shots, crashes and pickups.
import { RADIO } from './config.js';
import { mulberry32 } from './random.js';

const SCALES = {
  // minor pentatonic-ish rows, one per station, so each station sounds different.
  '88.1': [220, 261.6, 293.7, 329.6, 392, 440, 523.3],
  '92.4': [164.8, 196, 220, 246.9, 293.7, 329.6, 392],
  '101.7': [261.6, 293.7, 329.6, 392, 440],
};

export class AudioEngine {
  constructor() {
    this.ctx = null; this.master = null;
    this.station = 0; this.radioOn = true;
    this._nextNote = 0; this._step = 0; this._noteTimer = null;
    this.engineOsc = null; this.engineGain = null;
    this.sirenOsc = null; this.sirenGain = null;
    this._trackTimer = null;
  }

  ensure() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.5;
    this.master.connect(this.ctx.destination);
    // Engine hum: two detuned saws through a lowpass.
    this.engineOsc = this.ctx.createOscillator();
    this.engineOsc.type = 'sawtooth'; this.engineOsc.frequency.value = 55;
    const engineOsc2 = this.ctx.createOscillator();
    engineOsc2.type = 'sawtooth'; engineOsc2.frequency.value = 55.7;
    const lp = this.ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 320;
    this.engineGain = this.ctx.createGain(); this.engineGain.gain.value = 0;
    this.engineOsc.connect(lp); engineOsc2.connect(lp);
    lp.connect(this.engineGain); this.engineGain.connect(this.master);
    this.engineOsc.start(); engineOsc2.start();
    this._engineOsc2 = engineOsc2;
    // Police siren: sine that slides between two tones.
    this.sirenOsc = this.ctx.createOscillator();
    this.sirenOsc.type = 'sine'; this.sirenOsc.frequency.value = 700;
    this.sirenGain = this.ctx.createGain(); this.sirenGain.gain.value = 0;
    this.sirenOsc.connect(this.sirenGain); this.sirenGain.connect(this.master);
    this.sirenOsc.start();
    this._sirenPhase = 0;
    this.startRadio();
  }

  setEngine(speedKmh, inCar) {
    if (!this.ctx) return;
    const f = 48 + speedKmh * 1.1;
    this.engineOsc.frequency.setTargetAtTime(f, this.ctx.currentTime, 0.08);
    this._engineOsc2.frequency.setTargetAtTime(f * 1.007, this.ctx.currentTime, 0.08);
    this.engineGain.gain.setTargetAtTime(inCar ? 0.05 + Math.min(0.05, speedKmh / 4000) : 0.015, this.ctx.currentTime, 0.1);
  }

  setSiren(on, wanted) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    this.sirenGain.gain.setTargetAtTime(on ? 0.035 + wanted * 0.008 : 0, now, 0.2);
    if (on) {
      this._sirenPhase += 0.5;
      this.sirenOsc.frequency.setTargetAtTime(this._sirenPhase % 2 === 0 ? 660 : 880, now, 0.05);
    }
  }

  startRadio() {
    if (!this.ctx || this._noteTimer) return;
    this._step = 0;
    this._noteTimer = setInterval(() => this.playRadioStep(), 240);
  }

  playRadioStep() {
    if (!this.ctx || !this.radioOn) return;
    const station = RADIO[this.station];
    const scale = SCALES[station.id];
    const rng = mulberry32(station.seed * 1000 + this._step);
    const note = scale[Math.floor(rng() * scale.length)];
    const oct = rng() < 0.3 ? 2 : 1;
    const osc = this.ctx.createOscillator();
    osc.type = station.id === '92.4' ? 'square' : 'triangle';
    osc.frequency.value = note * oct;
    const g = this.ctx.createGain();
    const t = this.ctx.currentTime;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(station.id === '101.7' ? 0.02 : 0.06, t + 0.03);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
    osc.connect(g); g.connect(this.master);
    osc.start(t); osc.stop(t + 0.25);
    // Bass on the beat.
    if (this._step % 4 === 0) {
      const b = this.ctx.createOscillator(); b.type = 'sine';
      b.frequency.value = note / 4;
      const bg = this.ctx.createGain();
      bg.gain.setValueAtTime(0.08, t); bg.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
      b.connect(bg); bg.connect(this.master); b.start(t); b.stop(t + 0.32);
    }
    this._step += 1;
    if (this._step % 64 === 0) this._track = (this._track ?? 0) + 1;
  }

  get trackIndex() { return (this._track ?? 0) % 3; }
  get stationDef() { return RADIO[this.station]; }
  get trackName() { return RADIO[this.station].tracks[this.trackIndex]; }

  nextStation() {
    this.station = (this.station + 1) % RADIO.length;
    this._step = 0;
    return RADIO[this.station];
  }

  blip(freq, dur, type = 'sine', vol = 0.12) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator(); o.type = type; o.frequency.value = freq;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.master); o.start(t); o.stop(t + dur + 0.02);
  }

  shot() { this.noiseBurst(0.12, 0.25, 1200); }
  crash(intensity) { this.noiseBurst(0.25, 0.2 * Math.min(1, intensity / 20), 300); }
  pickup() { this.blip(880, 0.12, 'sine', 0.1); this.blip(1320, 0.18, 'sine', 0.1); }
  missionComplete() { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => this.blip(f, 0.3, 'triangle', 0.12), i * 110)); }

  noiseBurst(dur, vol, cutoff) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const len = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource(); src.buffer = buf;
    const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = cutoff;
    const g = this.ctx.createGain(); g.gain.value = vol;
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start(t);
  }
}
