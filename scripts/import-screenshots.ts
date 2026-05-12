/**
 * Import a folder of screenshots taken in the curate order into
 * public/climbing-photos/<gym-id>-1.<ext>.
 *
 * Workflow:
 *   1. Take screenshots in the order printed by `pnpm curate-order` (or the
 *      one we agreed on).
 *   2. Drop all of them into ./incoming-photos/ (or pass a custom folder).
 *   3. Run: pnpm import-photos [folder] [--dry-run] [--force]
 *
 * Sorting: files are matched to gyms by ascending mtime (capture time). The
 * Mac screenshot tool uses a timestamp in the filename, so name-sort works
 * the same. mtime is more robust if you've renamed them.
 */

import { readdirSync, statSync, mkdirSync, renameSync, existsSync, copyFileSync } from "node:fs";
import { join, extname } from "node:path";
import { climbingGyms, type ClimbingGym } from "../data/climbing-gyms";

const ALLOWED = new Set([".webp", ".jpg", ".jpeg", ".png"]);
const DEST_DIR = join(process.cwd(), "public", "climbing-photos");
const DEFAULT_INCOMING = join(process.cwd(), "incoming-photos");

const DISTRICT_ORDER = new Map<string, number>([
  ["东城", 0], ["西城", 1], ["朝阳", 2], ["海淀", 3],
  ["丰台", 4], ["石景山", 5], ["昌平", 6], ["大兴", 7],
  ["通州", 8], ["房山", 9], ["顺义", 10],
]);

function orderedGyms(): ClimbingGym[] {
  return [...climbingGyms].sort((a, b) => {
    const d = (DISTRICT_ORDER.get(a.district) ?? 99) - (DISTRICT_ORDER.get(b.district) ?? 99);
    if (d !== 0) return d;
    const ar = a.area.localeCompare(b.area, "zh-CN");
    if (ar !== 0) return ar;
    return a.name.localeCompare(b.name, "zh-CN");
  });
}

function listImages(dir: string): { name: string; full: string; mtimeMs: number }[] {
  if (!existsSync(dir)) {
    throw new Error(`incoming folder not found: ${dir}`);
  }
  return readdirSync(dir)
    .filter((n) => ALLOWED.has(extname(n).toLowerCase()))
    .map((n) => {
      const full = join(dir, n);
      return { name: n, full, mtimeMs: statSync(full).mtimeMs };
    })
    .sort((a, b) => a.mtimeMs - b.mtimeMs);
}

function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const force = args.includes("--force");
  const move = args.includes("--move"); // default: copy (safe). --move removes source.
  const folder = args.find((a) => !a.startsWith("--")) ?? DEFAULT_INCOMING;

  console.log(`incoming: ${folder}`);
  console.log(`mode:     ${dryRun ? "dry run" : move ? "move (will delete sources)" : "copy"}`);
  console.log(`overwrite:${force ? " yes (force)" : " no (skip if dest exists)"}`);
  console.log();

  const gyms = orderedGyms();
  const files = listImages(folder);

  if (files.length === 0) {
    console.log("no image files found.");
    return;
  }

  if (files.length !== gyms.length) {
    console.warn(
      `⚠ count mismatch: ${files.length} files, ${gyms.length} gyms. ` +
        `Will map by index — extras will be ignored, missing tail will be unmapped.\n`,
    );
  }

  if (!dryRun) mkdirSync(DEST_DIR, { recursive: true });

  let written = 0;
  let skipped = 0;
  const max = Math.min(files.length, gyms.length);

  for (let i = 0; i < max; i++) {
    const file = files[i];
    const gym = gyms[i];
    const ext = extname(file.name).toLowerCase().replace(/^\.jpeg$/, ".jpg");
    const destName = `${gym.id}-1${ext}`;
    const destPath = join(DEST_DIR, destName);
    const idx = String(i + 1).padStart(2, "0");

    if (existsSync(destPath) && !force) {
      console.log(`${idx}. SKIP   ${file.name} → ${destName} (already exists)`);
      skipped++;
      continue;
    }

    if (dryRun) {
      console.log(`${idx}. PLAN   ${file.name} → ${destName}`);
    } else {
      if (move) renameSync(file.full, destPath);
      else copyFileSync(file.full, destPath);
      console.log(`${idx}. ${move ? "MOVE  " : "COPY  "} ${file.name} → ${destName}`);
      written++;
    }
  }

  if (files.length > max) {
    console.log(`\n⚠ ${files.length - max} extra files ignored.`);
  }
  if (gyms.length > max) {
    console.log(`\n⚠ ${gyms.length - max} gyms still need photos.`);
  }

  console.log(`\n${dryRun ? "(dry-run)" : `wrote ${written}, skipped ${skipped}`}.`);
  if (!dryRun) console.log(`\nrefresh /climbing — photos should show up automatically.`);
}

try {
  main();
} catch (e) {
  console.error((e as Error).message);
  process.exit(1);
}
