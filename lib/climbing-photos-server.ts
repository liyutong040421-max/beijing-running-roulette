import { readdir } from "node:fs/promises";
import { join } from "node:path";
import type { PhotoManifest } from "@/lib/climbing-photos";

const PHOTO_DIR = join(process.cwd(), "public", "climbing-photos");
const FILENAME_RE = /^([a-z0-9-]+)-(\d+)\.(webp|jpg|jpeg|png)$/i;

// Scan public/climbing-photos/ for files named <gym-id>-<n>.<ext>. Returns a
// map from gym id to ordered absolute paths suitable for <img src=>.
//
// Convention: drop a file in the folder, refresh, see it. No data edit needed.
// The data layer's optional `photos` field still wins when present (lets you
// override alt text or pull from elsewhere).
export async function loadPhotoManifest(): Promise<PhotoManifest> {
  let files: string[];
  try {
    files = await readdir(PHOTO_DIR);
  } catch {
    return {};
  }
  const manifest: PhotoManifest = {};
  for (const file of files) {
    const m = file.match(FILENAME_RE);
    if (!m) continue;
    const id = m[1];
    if (!manifest[id]) manifest[id] = [];
    manifest[id].push(`/climbing-photos/${file}`);
  }
  for (const id in manifest) manifest[id].sort();
  return manifest;
}
