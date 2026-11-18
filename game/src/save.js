// Save / load: money, rep, mission progress, the player's car and spot, the
// clock and the radio station — everything needed to pick up where Dario
// left off. One localStorage key, versioned, never a network call.
import { SAVE_KEY, START_MONEY } from './config.js';

export function defaultSave() {
  return {
    version: 1, money: START_MONEY, rep: 0, score: 0,
    missionIndex: 0, completed: 0, day: 1, clock: 18.5 * 3600,
    carKind: 'sports', x: 0, z: 0, heading: 0,
    ammo: { pistol: 120, smg: 240 }, station: 0,
  };
}

export function loadSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || data.version !== 1) return null;
    return { ...defaultSave(), ...data };
  } catch {
    return null;
  }
}

export function writeSave(state) {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

export function clearSave() {
  try { window.localStorage.removeItem(SAVE_KEY); } catch { /* private mode */ }
}
