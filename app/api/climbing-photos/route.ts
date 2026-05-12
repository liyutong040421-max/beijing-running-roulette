import { writeFile, mkdir, unlink, readdir } from "node:fs/promises";
import { join } from "node:path";
import { climbingGyms } from "@/data/climbing-gyms";
import { loadPhotoManifest } from "@/lib/climbing-photos-server";

export const runtime = "nodejs";

const PHOTO_DIR = join(process.cwd(), "public", "climbing-photos");
const MAX_BYTES = 12 * 1024 * 1024; // 12 MB
const MIME_TO_EXT: Record<string, string> = {
  "image/webp": "webp",
  "image/jpeg": "jpg",
  "image/png": "png",
};

const FILENAME_RE = /^([a-z0-9-]+)-(\d+)\.(webp|jpg|jpeg|png)$/i;

export async function GET() {
  const manifest = await loadPhotoManifest();
  return Response.json({ manifest });
}

export async function POST(request: Request) {
  const form = await request.formData().catch(() => null);
  if (!form) return Response.json({ error: "expected multipart form" }, { status: 400 });

  const gymId = form.get("gymId");
  const file = form.get("file");

  if (typeof gymId !== "string" || !gymId) {
    return Response.json({ error: "gymId required" }, { status: 400 });
  }
  if (!(file instanceof File)) {
    return Response.json({ error: "file required" }, { status: 400 });
  }
  if (!climbingGyms.some((g) => g.id === gymId)) {
    return Response.json({ error: `unknown gym: ${gymId}` }, { status: 404 });
  }
  const ext = MIME_TO_EXT[file.type];
  if (!ext) {
    return Response.json(
      { error: `unsupported type ${file.type}; need webp/jpg/png` },
      { status: 400 },
    );
  }
  if (file.size > MAX_BYTES) {
    return Response.json(
      { error: `file too big (${(file.size / 1024 / 1024).toFixed(1)}MB), max 12MB` },
      { status: 413 },
    );
  }

  await mkdir(PHOTO_DIR, { recursive: true });
  const existing = await readdir(PHOTO_DIR).catch(() => []);
  let n = 1;
  while (existing.some((f) => f.startsWith(`${gymId}-${n}.`))) n++;

  const filename = `${gymId}-${n}.${ext}`;
  const buf = Buffer.from(await file.arrayBuffer());
  await writeFile(join(PHOTO_DIR, filename), buf);

  return Response.json({ src: `/climbing-photos/${filename}`, name: filename, gymId, n });
}

export async function DELETE(request: Request) {
  const url = new URL(request.url);
  const filename = url.searchParams.get("file") ?? "";
  if (!FILENAME_RE.test(filename)) {
    return Response.json({ error: "invalid filename" }, { status: 400 });
  }
  await unlink(join(PHOTO_DIR, filename)).catch(() => {});
  return Response.json({ ok: true });
}
