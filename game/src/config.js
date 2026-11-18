// Vela Bay — configuration: the city layout, vehicles, weapons, radio and the
// eight story missions. Everything here is original fiction: a made-up island
// city, its districts, its people and its cars. Nothing is taken from any
// commercial game.
export const WORLD = {
  half: 330,            // land extends -330..330 on x and z
  block: 60,            // city block size
  street: 12,           // street width
  roads: [-240, -180, -120, -60, 0, 60, 120, 180, 240],
  beachX: -285,         // beach-strip road along the west coast
  oceanX: -330,         // ocean starts west of here
  causewayZ: 0,         // bridge runs east along z = 0
  isletX: 470,          // islet centre (lighthouse rock)
  isletHalf: 55,
};

export const DISTRICTS = [
  { name: 'Marina Row',  x0: -330, z0: -330, x1: -240, z1: 330,  tint: 0xffd9a0 },
  { name: 'Downtown',    x0: -180, z0: -180, x1: 180,  z1: 180,  tint: 0x9fc4ff },
  { name: 'Old Harbor',  x0: -240, z0: 180,  x1: 240,  z1: 330,  tint: 0xffb08a },
  { name: 'Hillside',    x0: 180,  z0: -330, x1: 330,  z1: -120, tint: 0xb8e6a0 },
  { name: 'Palm Causeway', x0: 330, z0: -40, x1: 530,  z1: 40,   tint: 0xffe08a },
];

export function districtAt(x, z) {
  for (const d of DISTRICTS) if (x >= d.x0 && x <= d.x1 && z >= d.z0 && z <= d.z1) return d.name;
  return 'Vela Bay';
}

// Palette: sunset coastal — warm sand, coral roofs, teal sea, pink neon.
export const PALETTE = {
  sand: 0xe8c98f, sea: 0x1e7f8e, seaDeep: 0x155e75, asphalt: 0x2c2f36,
  sidewalk: 0x9a938a, grass: 0x5f9e5a, coral: 0xff6f61, teal: 0x2ec4b6,
  neonPink: 0xff2e88, neonCyan: 0x00e5ff, sunOrange: 0xff9e4f,
};

export const VEHICLES = {
  sports:  { name: 'Vela Comet GT',  color: 0xff2e63, top: 62, accel: 26, grip: 1.0,  price: 0 },
  sedan:   { name: 'Marina Sedan',   color: 0x3a6fd8, top: 46, accel: 18, grip: 0.9,  price: 0 },
  taxi:    { name: 'Bay Cab',        color: 0xffc93c, top: 44, accel: 17, grip: 0.9,  price: 0 },
  van:     { name: 'Harbor Van',     color: 0xe8e4da, top: 38, accel: 13, grip: 0.8,  price: 0 },
  truck:   { name: 'Dock Truck',     color: 0x8a6d3b, top: 34, accel: 11, grip: 0.75, price: 0 },
  police:  { name: 'VPD Interceptor',color: 0x11151c, top: 56, accel: 24, grip: 1.05, price: 0 },
};

export const WEAPONS = {
  fists:  { name: 'Fists',   slot: 1, damage: 12, range: 2.2, rate: 0.35, ammo: Infinity, auto: false },
  pistol: { name: 'P9 Pistol', slot: 2, damage: 34, range: 55, rate: 0.28, ammo: 120, auto: false },
  smg:    { name: 'K-9 SMG',  slot: 3, damage: 18, range: 48, rate: 0.09, ammo: 240, auto: true },
};

export const RADIO = [
  { id: '88.1', name: '88.1 VELA FM', genre: 'sunset synth', seed: 11,
    tracks: ['Neon Tide — Coastline Drive', 'Palm Static — Afterglow', 'Mara Kade — Night Ferry'] },
  { id: '92.4', name: '92.4 COAST ROCK', genre: 'harbor rock', seed: 23,
    tracks: ['The Breakers — Salt Air', 'Old Harbor — Low Tide Blues', 'Static — Causeway Lights'] },
  { id: '101.7', name: '101.7 HARBOR TALK', genre: 'talk + traffic', seed: 37,
    tracks: ['Vela Bay traffic report', 'Caller: the wheel never sleeps', 'Harbor weather, then sports'] },
];

// The eight story jobs. Waypoints are world (x, z) on roads; `wanted` is the
// heat the job starts with; `chase` spawns police on that stage.
export const MISSIONS = [
  { id: 1, name: 'First Light', giver: 'Mara Kade',
    brief: 'Dario, welcome back to Vela Bay. Take the Comet down Marina Row and shake off the rust. Easy drive — just get there in one piece.',
    stages: [
      { text: 'Drive to the Marina Row boardwalk', x: -285, z: 60, wanted: 0 },
      { text: 'Meet Mara at the Vela Wheel', x: -285, z: -120, wanted: 0 },
    ], reward: 400, rep: 10 },
  { id: 2, name: 'Paper Trail', giver: 'Sol Ibarra',
    brief: 'Sol needs a ledger moved before the harbor office opens. Two stops, no noise. Drive clean and the money is yours.',
    stages: [
      { text: 'Pick up the ledger in Downtown', x: 60, z: -60, wanted: 0 },
      { text: 'Drop it at the Old Harbor office', x: 0, z: 240, wanted: 1 },
    ], reward: 900, rep: 15 },
  { id: 3, name: 'Harbor Lights', giver: 'Mara Kade',
    brief: 'A crate went missing off the night ferry. Find it, bring it back, and try not to wake the whole harbor.',
    stages: [
      { text: 'Search the harbor warehouses', x: -120, z: 180, wanted: 0 },
      { text: 'Haul the crate to Marina Row', x: -285, z: -60, wanted: 1 },
    ], reward: 1400, rep: 20 },
  { id: 4, name: 'The Long Way Home', giver: 'Otto Halloran',
    brief: 'Otto tuned a car up on Hillside and the buyer wants it downtown by dusk. Hills are steep, brakes are new. Go.',
    stages: [
      { text: 'Collect the tuned car on Hillside', x: 240, z: -240, wanted: 0 },
      { text: 'Deliver it to Downtown', x: 0, z: 60, wanted: 0 },
    ], reward: 1800, rep: 25 },
  { id: 5, name: 'Static on 88.1', giver: 'Sol Ibarra',
    brief: 'Someone is jamming Vela FM from a rooftop relay. Sol traced it to the east tower. Get up there and pull the plug.',
    stages: [
      { text: 'Reach the relay tower', x: 180, z: 180, wanted: 1 },
      { text: 'Lose the patrols, return Downtown', x: -60, z: -120, wanted: 2 },
    ], reward: 2400, rep: 30 },
  { id: 6, name: 'Causeway Run', giver: 'Mara Kade',
    brief: 'The causeway is the only road off the islet, and the VPD knows it. Cross it fast, cross it loud, and do not stop for anyone.',
    stages: [
      { text: 'Reach the Palm Causeway bridge', x: 300, z: 0, wanted: 2, chase: true },
      { text: 'Cross to the islet lighthouse', x: 470, z: 0, wanted: 3, chase: true },
    ], reward: 3200, rep: 35 },
  { id: 7, name: 'The Vela Wheel', giver: 'Otto Halloran',
    brief: 'Otto hid a lockbox under the wheel, and a rival crew is already circling it. Grab it first, then vanish into the hills.',
    stages: [
      { text: 'Grab the lockbox at the Vela Wheel', x: -285, z: -120, wanted: 2, chase: true },
      { text: 'Escape to the Hillside lookout', x: 240, z: -240, wanted: 3, chase: true },
    ], reward: 4200, rep: 40 },
  { id: 8, name: 'Heat Wave', giver: 'Mara Kade',
    brief: 'Five stars, one island, no way out but through. Run the whole city, lose the helicopter, and meet me where this all started.',
    stages: [
      { text: 'Outrun the dragnet through Downtown', x: 0, z: -180, wanted: 4, chase: true },
      { text: 'Break across the causeway', x: 470, z: 0, wanted: 5, chase: true },
      { text: 'Meet Mara at Marina Row', x: -285, z: 120, wanted: 5, chase: true },
    ], reward: 8000, rep: 60 },
];

export const CREW = {
  'Mara Kade':     { role: 'Fixer',    color: '#ff2e88', initials: 'MK',
    lines: ['Dario. You drive, I plan. That is the whole deal.', 'The wheel never sleeps, and neither do the VPD. Move.'] },
  'Sol Ibarra':    { role: 'Hacker',   color: '#00e5ff', initials: 'SI',
    lines: ['Cameras looped for ninety seconds. Make them count.', 'I see every patrol on the grid. Left at the next light.'] },
  'Otto Halloran': { role: 'Mechanic', color: '#ffb020', initials: 'OH',
    lines: ['She purrs now. Try not to bend her.', 'Brakes are new. The rest is up to your right foot.'] },
  'Dario Venn':    { role: 'Driver',   color: '#ff2e63', initials: 'DV',
    lines: ['One more job. Then I am done. Probably.', 'Hold on. This next part gets loud.'] },
};

export const DAY_LENGTH_S = 600; // one full in-game day = 10 real minutes
export const START_MONEY = 250;
export const SAVE_KEY = 'velabay-save-v1';
