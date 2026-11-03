/** Budget for a snapshot filename component; `.json` plus slack stays under the 255-byte
 * per-component limit every supported filesystem enforces. */
const MAX_STATIC_NAME_LENGTH = 200;

const FNV1A_OFFSET_BASIS = 0x811c9dc5;
const FNV1A_PRIME = 0x01000193;

/**
 * 64-bit digest (two 32-bit FNV-1a lanes over the encoded id's bytes, one forward and one
 * reversed) as 16 hex characters. Pure JS, deterministic across processes, and free of
 * `node:crypto` so the helper can bundle for the browser.
 */
function hashComponentId(id: string): string {
  const encoded = encodeURIComponent(id);
  let forward = FNV1A_OFFSET_BASIS;
  let reversed = FNV1A_OFFSET_BASIS;

  for (let index = 0; index < encoded.length; index++) {
    forward = Math.imul(forward ^ encoded.charCodeAt(index), FNV1A_PRIME);
    reversed = Math.imul(reversed ^ encoded.charCodeAt(encoded.length - 1 - index), FNV1A_PRIME);
  }

  return (
    (forward >>> 0).toString(16).padStart(8, '0') + (reversed >>> 0).toString(16).padStart(8, '0')
  );
}

/**
 * ASCII-safe on-disk name for one component id — the single derivation shared by the static
 * snapshot writer, the browser static loader, and the manifest `$ref`s, so all three agree.
 *
 * Component ids may be any string (the unicode template story uses `id: '😀'`), but snapshot
 * filenames must survive three boundaries beyond the filesystem:
 *
 * - Static hosts percent-decode request paths before their filesystem lookup, so the name must be
 *   a fixed point of that decode — a literal `%` on disk is unreachable through any URL fetch.
 * - Filenames travel through tar/zip archives that must extract on every platform: Windows bsdtar
 *   converts entry names to the system ANSI code page, which cannot represent non-ASCII names.
 * - Names are bounded: percent-encoding would also blow the 255-byte per-component filename limit
 *   for long non-ASCII ids (each CJK character grows to 9 encoded bytes).
 *
 * Ids already spelled as short portable names — the overwhelming majority, and every plain ASCII
 * id — pass through byte-identical so snapshots stay greppable. Everything else maps to a bounded,
 * percent-free, collision-resistant digest name (`id-<64-bit digest of the full id>`).
 */
export function componentIdToStaticName(id: string): string {
  if (id === '') {
    return '_empty_';
  }

  // `encodeURIComponent` is the identity on ids spelled entirely in [A-Za-z0-9-_.!~*'()], so this
  // keeps common ids (and every ASCII id) readable in the filesystem, manifests, and debugger.
  if (encodeURIComponent(id) === id && id.length <= MAX_STATIC_NAME_LENGTH) {
    return id;
  }

  return `id-${hashComponentId(id)}`;
}
