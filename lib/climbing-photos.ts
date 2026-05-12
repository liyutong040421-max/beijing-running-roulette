export type PhotoManifest = Record<string, string[]>;

export function pickFirstPhoto(
  gymId: string,
  explicit: { src: string; alt: string }[] | undefined,
  manifest: PhotoManifest,
): { src: string; alt: string } | null {
  if (explicit && explicit[0]) return explicit[0];
  const auto = manifest[gymId]?.[0];
  if (auto) return { src: auto, alt: gymId };
  return null;
}
