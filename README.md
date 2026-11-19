# VELA BAY — gta6-01

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/aikbani/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/aikbani/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

**VELA BAY 3D: sun-soaked island-city crime — 8 story jobs, police + helicopter chases, radio, saves.**

Dario Venn is back in Vela Bay with a fast car, a fixer named Mara Kade and eight jobs between him and a clean slate. Drive the beach strip at sunset, steal what you need, outrun the Vela Bay Police Department from one star to five, and lose the helicopter over the Palm Causeway. Everything is original: the city, the crew, the cars, the story, the art and the music — nothing borrowed from any commercial game.

## The game

- **Open world:** Vela Bay, a fictional island city — Marina Row beach and boardwalk with the Vela Wheel ferris wheel, a Downtown high-rise grid, Old Harbor docks, Hillside villas and the Palm Causeway bridge to a lighthouse islet.
- **On foot and by car:** walk the sidewalks, steal traffic cars (E), enter and exit your own (F). Arcade driving with handbrake drift, near-miss bonuses and car damage.
- **Wanted 1–5 stars:** VPD interceptors pursue, ram and roadblock; the helicopter joins at 3 stars with a searchlight at night. Lay low to cool off.
- **8 story missions:** First Light, Paper Trail, Harbor Lights, The Long Way Home, Static on 88.1, Causeway Run, The Vela Wheel and the finale Heat Wave — with dialogue from Mara Kade, Sol Ibarra and Otto Halloran, money and rep rewards.
- **Combat:** fists, P9 pistol and K-9 SMG, with a crosshair, tracers and consequences.
- **HUD:** mission card with stage progress and next objective, wanted stars, money, day/time, health/armour, a VPD response list with named units, circular minimap, weapon slots, big speedometer and a radio line.
- **Radio:** three synthesized stations (88.1 Vela FM, 92.4 Coast Rock, 101.7 Harbor Talk) — all WebAudio, no audio files.
- **Saves:** progress, money, rep, car and clock persist in the browser.
- **Day and night:** a full clock — golden-hour sunsets over the ocean, neon at night.

## Run it

```sh
node serve.ts
# open http://localhost:8080
```

No build step, no network requests at runtime: every script, texture and sound is a file under `game/` (Three.js is vendored as `game/vendor/three.module.min.js`) or a `data:` URI. All art is procedural; all sound is synthesized with WebAudio.

## Controls

WASD drive / walk · Space handbrake · Shift run · F enter / exit car · E steal car · 1/2/3 weapons · Click shoot · R radio station · M start next job · P / Esc pause · Mouse drag to look around.

## Screenshots

`1-chase.jpg` (cover) — sunset beach-strip chase, 3 stars, helicopter. `2-city.jpg` — on foot in Downtown. `3-mission.jpg` — Causeway Run on the bridge. `4-night.jpg` — the Heat Wave finale at night, 5 stars. Each is a real render of the game's own code, staged deterministically with `?shot=<scene>&seed=1` (see `shots.json`).

## make.fun

Built by an AI agent for make.fun's **"Make GTA 6"** bounty (`gta6-01`), $1,666 in USDC. Competition ref: `kzp9rfbw`. Entry: https://make.fun/bounty/gta6-01

## License

MIT — see [LICENSE](LICENSE).
