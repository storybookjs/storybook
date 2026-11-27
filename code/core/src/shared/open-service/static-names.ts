/**
 * Two 32-bit FNV-1a lanes (independent offset bases, both run forward over the id's UTF-16 code
 * units) as 16 hex characters. Not cryptographic — just enough spread that distinct ids collide
 * with negligible probability. Pure JS, deterministic across processes, and free of `node:crypto`
 * so the helper can bundle for the browser.
 */
function hashComponentId(id: string): string {
  let lane1 = 0x811c9dc5;
  let lane2 = 0x811c9dc5 ^ 0x9e3779b9;

  for (let index = 0; index < id.length; index++) {
    const unit = id.charCodeAt(index);
    lane1 = Math.imul(lane1 ^ unit, 0x01000193);
    lane2 = Math.imul(lane2 ^ unit, 0x01000193);
  }

  return (lane1 >>> 0).toString(16).padStart(8, '0') + (lane2 >>> 0).toString(16).padStart(8, '0');
}

/**
 * ASCII-safe on-disk name for one component id — the single derivation shared by every
 * per-component static snapshot service (docgen, story-docs, addon-docs MDX), the browser static
 * loader, and the manifest `$ref`s, so all of them agree.
 *
 * Component ids may be any string (the unicode template story uses `id: '😀'`), but snapshot
 * filenames must survive three boundaries beyond the filesystem:
 *
 * - Static hosts percent-decode request paths before their filesystem lookup, so the name must be
 *   a fixed point of that decode — a literal `%` on disk is unreachable through any URL fetch.
 * - Filenames travel through tar/zip archives that must extract on every platform: Windows bsdtar
 *   converts entry names to the system ANSI code page, which cannot represent non-ASCII names,
 *   and Windows reserves characters like `*` and `:` everywhere.
 * - Per-component filename length is capped at 255 bytes on every supported filesystem, so
 *   escaping non-ASCII ids (each CJK character grows to 9 encoded bytes) is not an option either.
 *
 * Ids spelled entirely as short portable names — `[A-Za-z0-9._-]` up to 200 characters, which
 * covers every id `sanitize` produces and virtually all real ids — pass through byte-identical so
 * snapshots stay greppable. Everything else maps to a bounded, percent-free digest name
 * (`id-<digest of the full id>`). `_empty_` covers the empty id, and already-derived digest names
 * pass through, so the mapping is idempotent.
 */
export function componentIdToStaticName(id: string): string {
  if (id === '') {
    return '_empty_';
  }

  // 200 characters leaves room for `.json` and path segments under the 255-byte limit.
  if (/^[A-Za-z0-9._-]{1,200}$/.test(id)) {
    return id;
  }

  return `id-${hashComponentId(id)}`;
}
