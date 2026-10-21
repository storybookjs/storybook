# Rollup: path separators in module ids

Installed version: `rollup@4.53.2` (repo root `node_modules/rollup`). Probe:
`poc/path-separators/probes/rollup.mjs` (no resolver plugins, one recording plugin).

Sources used:

- Rollup plugin docs, v4.53.2: <https://github.com/rollup/rollup/blob/v4.53.2/docs/plugin-development/index.md> (rendered at <https://rollupjs.org/plugin-development/>)
- Rollup source, v4.53.2: [`src/utils/resolveId.ts`](https://github.com/rollup/rollup/blob/v4.53.2/src/utils/resolveId.ts), [`src/utils/path.ts`](https://github.com/rollup/rollup/blob/v4.53.2/src/utils/path.ts), [`src/ModuleLoader.ts`](https://github.com/rollup/rollup/blob/v4.53.2/src/ModuleLoader.ts)
- Installed build: `node_modules/rollup/dist/es/shared/node-entry.js` (lines cited below)
- Vite docs, "Path Normalization": <https://vite.dev/guide/api-plugin#path-normalization> (source: [`docs/guide/api-plugin.md`](https://github.com/vitejs/vite/blob/main/docs/guide/api-plugin.md))

## What the docs say

Rollup's docs never mention path separators or Windows for module ids. The relevant statements are:

- `resolveId`: "Returning `null` defers to other `resolveId` functions and eventually the default
  resolution behavior." (plugin-development/index.md L619). The default algorithm is not described.
- "The `importer` is the fully resolved id of the importing module. When resolving entry points,
  importer will usually be `undefined`." (L538)
- `load(id)`, `transform(code, id)`, `this.getModuleIds()`: only signatures; nothing on id format.
- The only "renormalization" the docs describe applies to **externals** (L619, L640), not to ids
  of bundled modules.

Vite's docs say it directly: "Vite normalizes paths while resolving ids to use POSIX separators
( / ) while preserving the volume in Windows. On the other hand, Rollup keeps resolved paths
untouched by default, so resolved ids have win32 separators ( \\ ) in Windows." It adds that
Rollup's own plugins call `normalizePath` from `@rollup/pluginutils` before comparing.

## What the source says

- `src/utils/path.ts` re-exports `basename, dirname, extname, relative, resolve` straight from
  `node:path` (last line). Its own `normalize()` (backslash to `/`) exists but is not used in
  resolution. Installed build: `node-entry.js` L11, `import { relative, dirname, basename, extname, resolve as resolve$1 } from 'node:path'`.
- `src/utils/resolveId.ts`: if a plugin returns a string, Rollup wraps it as `{ id: resolveIdResult, resolvedBy }`
  with no change (L30-L44; installed `node-entry.js` L20795-L20810). Otherwise it falls back to
  `importer ? resolve(dirname(importer), source) : resolve(source)` (L56; installed L20820), then
  only appends `.mjs`/`.js` if needed.
- `src/ModuleLoader.ts` `fetchModule` keys modules by the exact id string:
  `this.modulesById.get(id)` / `this.modulesById.set(id, module)` (L389, L415; installed
  L21406, L21418). No separator or case normalization before the lookup.

Consequences (reasoned from source, to be confirmed on Windows):

- On Windows `path.resolve` (win32) always emits `\`, even for `/` input:
  `path.win32.resolve('C:/x/entry.js') === 'C:\\x\\entry.js'`. So **every id produced by default
  resolution is native**, whatever form the entry `input` had.
- A plugin-returned id is never touched, so a `/` id stays `/`. Since modules are keyed by the raw
  string, `C:/x/a.js` and `C:\x\a.js` are two different modules.

## Claims

### 1. Output: ids from default resolution of relative imports are native (`\` on Windows)

Probe ids `rollup.default.*`: `resolveId` `importer`, `load`/`transform` `id`, `this.getModuleIds()`,
`chunk.moduleIds`, `Object.keys(chunk.modules)`, `chunk.facadeModuleId`.

Docs: Rollup docs silent; Vite docs state it explicitly. Source: default resolution is
`node:path` `resolve`, which is native on Windows; ids are then passed through unchanged
(`resolveId.ts` L56, `ModuleLoader.ts` L389/L415).

**Verdict: confirmed by docs (Vite docs) and by source.** Windows run should show `backslash` for all.

### 2. Input: entry `input` as `\` path vs `/` path

Probe ids `rollup.input.{native,forward}.*`.

Docs: silent. Source: the entry goes through the same `resolveId` (`ModuleLoader.ts` L664-L671,
`loadEntryModule`). The plugin hook sees `source` exactly as given; with no plugin result Rollup
runs `resolve(source)`, which on Windows turns `C:/x/entry.js` into `C:\x\entry.js`.

So both forms should be accepted, and the original claim's sub-hypothesis ("a `/` input produces
`/` ids for the entry and `\` for its relative imports") is **contradicted by source**: with no
resolver plugins a `/` input still gives a `\` entry id (and `\` import ids). A `/` entry id
would only happen if a plugin's `resolveId` returned the `/` string for the entry.

**Verdict: confirmed by source (both forms accepted, both give native ids); undetermined (needs Windows run) for the final check.**

### 3. Input: a plugin returning a `/` absolute id is kept as-is; duplicates on Windows

Probe ids `rollup.pluginId.*`. The plugin returns `C:/.../a.js` for `./a.js` from `entry.js`;
`sub/b.js` imports `../a.js` via default resolution.

Docs: silent on string ids. Source: string results become `{ id }` unchanged (`resolveId.ts`
L37-L42), and `modulesById` is keyed by the raw string, so on Windows `C:/.../a.js` and
`C:\...\a.js` are two modules. `load`/`transform` should see both ids, and the bundle should
contain a.js twice. On POSIX the two ids are the same string, so there is one module.

**Verdict: confirmed by source (kept as-is); duplicate module is undetermined (needs Windows run), predicted yes.**
