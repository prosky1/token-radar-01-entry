// Token Radar's entrypoint, rewritten: same flags, same outputs, new wording throughout.
//
// The run, in order: read the sealed snapshot (from --input, a file or a directory holding
// snapshot.json), score every pre-token protocol with the model in lib/model.ts, refuse a board
// the gate would refuse, then write board.json and data.js, copy dashboard/ and screenshots/
// out of this repository, and finish by writing dossier.json with the vendored make.fun
// library. The dossier goes last on purpose: the scorer rebuilds it from this same output
// directory and compares the bytes, so it has to describe exactly what was written.
//
// The dashboard is a static page with no framework and no network: dashboard/index.html,
// dashboard/app.css and dashboard/app.js read data.js, which this program writes from the
// same board, so the page can never disagree with the board it shows.
//
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input <kit>/input/snapshot.json

import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  boardIssue,
  buildRadar,
  dataScript,
  parseSnapshot,
} from "./lib/model.ts";
import { buildDossier } from "./vendor/makefun-board.ts";

// This repository's own directory, so dashboard/ and screenshots/ can be copied out of it.
const repoRoot = fileURLToPath(new URL(".", import.meta.url));

// The caps the scorer's reference (gate.json) hands the dossier builder. Only the text cap
// shapes bytes; the screenshot and dashboard caps only refuse.
const DOSSIER_TEXT_CAP = 65_536;
const SHOT_LIMIT = { max: 4, max_bytes: 524_288 };
const DASH_LIMIT = { max_files: 400, max_bytes: 4_194_304 };
const SHOT_NAME = /^[A-Za-z0-9_][A-Za-z0-9._-]{0,127}$/;

/**
 * The value of a `--name value` flag, or of a `--name=value` flag, or `fallback` when the
 * command line names neither. A spaced flag wins over a joined one when both are given.
 */
function flagValue(name: string, fallback: string): string {
  const argv = process.argv;
  const spaced = argv.indexOf(`--${name}`);
  if (spaced !== -1 && spaced + 1 < argv.length) {
    return argv[spaced + 1]!;
  }
  const joined = argv.find((entry) => entry.startsWith(`--${name}=`));
  if (joined === undefined) {
    return fallback;
  }
  return joined.slice(name.length + 3);
}

/**
 * Copy one directory's plain files into `dest`, skipping dot-names and anything that is not a
 * regular file, and return the names that were copied, in directory order.
 */
function copyPlainFiles(srcDir: string, destDir: string): string[] {
  if (!existsSync(srcDir)) {
    return [];
  }
  mkdirSync(destDir, { recursive: true });
  const copied: string[] = [];
  for (const entry of readdirSync(srcDir)) {
    if (entry.startsWith(".")) {
      continue;
    }
    const from = join(srcDir, entry);
    if (!statSync(from).isFile()) {
      continue;
    }
    copyFileSync(from, join(destDir, entry));
    copied.push(entry);
  }
  return copied;
}

/** The whole run: parse flags, score the snapshot, write the output directory. */
function main(): void {
  const inputFlag = flagValue("input", "/input");
  const inputPath = inputFlag.endsWith(".json")
    ? inputFlag
    : join(inputFlag, "snapshot.json");
  if (!existsSync(inputPath)) {
    process.stderr.write(
      "token radar: no snapshot at " +
        inputPath +
        ": pass --input <snapshot.json|directory> or mount the sealed /input\n",
    );
    process.exit(2);
  }
  const outDir = flagValue("output", process.env.MAKEFUN_OUTPUT_DIR ?? "/output");

  const snapshot = parseSnapshot(readFileSync(inputPath, "utf8"));
  const { board, radar } = buildRadar(snapshot);
  const issue = boardIssue(board, snapshot);
  if (issue !== null) {
    process.stderr.write(
      "token radar: the model wrote a board the gate refuses: " + issue + "\n",
    );
    process.exit(1);
  }

  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, "board.json"), JSON.stringify({ rows: board }) + "\n");
  writeFileSync(join(outDir, "data.js"), dataScript(radar));

  copyPlainFiles(join(repoRoot, "dashboard"), join(outDir, "dashboard"));
  const shots = copyPlainFiles(join(repoRoot, "screenshots"), join(outDir, "screenshots"));
  if (shots.length < 3) {
    process.stderr.write(
      "token radar: screenshots/ holds " +
        shots.length +
        " image" +
        (shots.length === 1 ? "" : "s") +
        ": hand in 3, the board, a detail view and a filtered view\n",
    );
    process.exit(1);
  }
  for (const name of shots) {
    if (!SHOT_NAME.test(name)) {
      process.stderr.write(
        "token radar: screenshots/" +
          name +
          ": a name is letters, digits and . _ -, 1 to 128 characters\n",
      );
      process.exit(1);
    }
  }

  // The dossier is written last: the scorer rebuilds it from this output and compares bytes.
  writeFileSync(
    join(outDir, "dossier.json"),
    buildDossier(outDir, {
      text_max_bytes: DOSSIER_TEXT_CAP,
      screenshots: SHOT_LIMIT,
      dashboard: DASH_LIMIT,
    }),
  );

  process.stdout.write(
    "token radar: " +
      snapshot.protocols.length +
      " protocols, " +
      snapshot.watchlist.length +
      " on the watchlist, " +
      board.length +
      " rows scored (" +
      radar.early_size +
      " early, " +
      radar.live_size +
      " live set aside)\n" +
      "token radar: wrote " +
      join(outDir, "board.json") +
      ", " +
      join(outDir, "data.js") +
      ", " +
      join(outDir, "dashboard") +
      " (3 files), " +
      join(outDir, "screenshots") +
      " (" +
      shots.length +
      " images) and " +
      join(outDir, "dossier.json") +
      "\n",
  );
}

main();
