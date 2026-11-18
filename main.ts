// Vela Bay — the entry program (Node 22, standard library only). It hands the
// game in: copies this repository's game/ and screenshots/ into the output
// directory and writes /output/dossier.json with the vendored make.fun
// library, exactly as the grader expects. No network, no build step, no
// generated files — the game is plain static files under game/ and the
// screenshots are real renders of it.
//
// Play it locally first with `node serve.ts` (http://localhost:8080), then
// rehearse the handoff with:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// Outside the grader, MAKEFUN_OUTPUT_DIR stands in for /output; inside the
// grader the program writes to /output itself.

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// Fresh output directory, then the whole game and its screenshots, verbatim.
mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) {
  cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });
}

// The dossier is the judge's view of the entry: the library writes it from
// the copied files, so the dossier always matches what was handed in. The
// caps below mirror the gate (reference/gate.json): at most 4 screenshots of
// 256 KiB, at most 993 files / 48 MiB under game/, paths under 1000 bytes,
// and the dossier text capped at 160 KiB.
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);
