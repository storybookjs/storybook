/**
 * ASCII-safe on-disk name for one component id — the single derivation shared by the static
 * snapshot writer, the browser static loader, and the manifest `$ref`s, so all three agree.
 *
 * Component ids may be any string (the unicode template story uses `id: '😀'`), but snapshot
 * filenames travel through tar/zip archives that must extract on every platform: Windows bsdtar
 * converts entry names to the system ANSI code page, which cannot represent non-ASCII names.
 * Percent-encoding is injective (no collisions) and reversible (`decodeURIComponent`).
 */
export function componentIdToStaticName(id: string): string {
  const encoded = encodeURIComponent(id);

  return encoded === '' ? '_empty_' : encoded;
}
