# Vite: path separators in plugin hooks, config, and `normalizePath`

Installed version: `vite@7.3.6` (repo root), which uses `rollup@4.53.2` for `build()`.
Source links point to the `v7.3.6` tag; installed-dist line numbers are in
`node_modules/vite/dist/node/chunks/config.js` (abbreviated `dist config.js`).

Probe: `poc/path-separators/probes/vite.mjs`. It covers `build({ write: false })` and a
middleware-mode `createServer()` + `ssrLoadModule('/index.js')`, with a recording plugin.

## Main documentation statement

[Plugin API → Path Normalization](https://github.com/vitejs/vite/blob/v7.3.6/docs/guide/api-plugin.md#path-normalization)
(published at https://vite.dev/guide/api-plugin#path-normalization):

> Vite normalizes paths while resolving ids to use POSIX separators ( / ) while preserving the
> volume in Windows. On the other hand, Rollup keeps resolved paths untouched by default, so
> resolved ids have win32 separators ( \\ ) in Windows. [...] So, for Vite plugins, when comparing
> paths against resolved ids it is important to first normalize the paths to use POSIX separators.
> An equivalent `normalizePath` utility function is exported from the `vite` module.
> `normalizePath('foo\\bar') // 'foo/bar'`

The docs say Vite normalizes "while resolving ids". They do not list which hooks or arguments
this covers, and they do not separate dev (Vite's own plugin container) from build (Rollup). The
rest of this file relies on source code for those details.

## Claim 1: plugin hooks receive `/`-separated absolute ids, volume kept

- **Docs:** see the quote above. It is general ("while resolving ids") and does not list hooks.
- **Source, build:** Rollup does not normalize ids. The `/` form comes from Vite's own resolver,
  `vite:resolve`, which returns every file it finds through `getRealPath()`, and that function
  calls `normalizePath`
  ([resolve.ts L1268-1273](https://github.com/vitejs/vite/blob/v7.3.6/packages/vite/src/node/plugins/resolve.ts#L1268-L1273),
  dist config.js L33012-33014). Rollup then uses that id for `load`, `transform`, `importer`,
  `getModuleInfo` and `getModuleIds`.
- **Source, dev:** `EnvironmentPluginContainer.resolveId` applies `normalizePath` to whatever id
  the plugins return ([pluginContainer.ts L466](https://github.com/vitejs/vite/blob/v7.3.6/packages/vite/src/node/server/pluginContainer.ts#L466),
  dist config.js L28815):
  `partial.id = isExternalUrl(id) || id[0] === '\0' ? id : normalizePath(id)`.
- **Exception, found in source:** when dev resolves a top-level URL (one with no importer), the
  `importer` argument defaults to `join(this.environment.config.root, 'index.html')`, and that
  `join` is `node:path`'s
  ([pluginContainer.ts L349-353](https://github.com/vitejs/vite/blob/v7.3.6/packages/vite/src/node/server/pluginContainer.ts#L349-L353),
  dist config.js L28754). On Windows, `path.win32.join` converts every `/` to `\`. So in this one
  case `resolveId` should see an importer like `C:\...\index.html`. The probe records this as
  `vite.dev.resolveId.entryImporter`, with the prediction "backslash on Windows".
- Volume: `normalizePath` only swaps the separators and runs `posix.normalize`, so `C:` is kept.
  The docs say this explicitly ("preserving the volume").
- **Verdict:** `confirmed by docs` for ids that Vite's resolver produces. Two exceptions come from
  source: the dev entry importer, and ids that a plugin returns during build (see claim 4).
  `undetermined (needs Windows run)` for the real Windows strings.

## Claim 2: `config.root` in `configResolved` is `/`-separated, even when given as `\`

- **Docs:** the [`root` option](https://vite.dev/config/shared-options#root) does not mention
  separators.
- **Source:** `const resolvedRoot = normalizePath(config.root ? path.resolve(config.root) : process.cwd())`
  ([config.ts L1155-1157](https://github.com/vitejs/vite/blob/v7.3.6/packages/vite/src/node/config.ts#L1155-L1157),
  dist config.js L35539).
- **Verdict:** `confirmed by source`. Windows run still pending.

## Claim 3: `root`, `build.rollupOptions.input` and `resolve.alias` accept both `\` and `/` on Windows

- **Docs:** silent on separators for all three options. The
  [`resolve.alias`](https://vite.dev/config/shared-options#resolve-alias) docs only say "When
  aliasing to file system paths, always use absolute paths."
- **Source:**
  - `root`: goes through `path.resolve` and then `normalizePath` (claim 2), so both forms give
    the same value.
  - `input`: Rollup calls `resolveId(input, undefined, { isEntry: true })`. In `vite:resolve`,
    `C:\...` matches the `isEntry && startsWithWordCharRE` branch. The path goes through
    `path.resolve`, then `tryFsResolve`, then `normalizePath`
    ([resolve.ts L259](https://github.com/vitejs/vite/blob/v7.3.6/packages/vite/src/node/plugins/resolve.ts#L259),
    dist config.js L32586). The drive check `windowsDrivePathPrefixRE = /^[A-Za-z]:[/\\]/`
    accepts both separators (dist config.js L2582-2590).
  - `alias`: `@rollup/plugin-alias` (bundled, dist config.js L8160-8162) uses plain string
    replacement, so the id becomes `C:\...\sub` + `/b.js` (mixed separators). It then calls
    `this.resolve`. `vite:resolve` handles the absolute path, and its result is normalized. A plugin
    that runs after alias sees the mixed `source`, which the probe saves in its raw output.
- **Verdict:** `undetermined (needs Windows run)`. Source predicts that every form is accepted
  and all of them resolve to the same three modules. Linux only runs the `/` form; the `\`
  variants are marked `skipped-on-posix`.

## Claim 4: a plugin's `resolveId` returns a native `\` id. Is it normalized?

- **Docs:** "Rollup keeps resolved paths untouched by default". This implies that during build, a
  `\` id returned by a plugin stays as it is. The docs say nothing explicit about dev.
- **Source:** it depends on the mode.
  - **Dev:** the id is normalized. `pluginContainer.resolveId` runs `normalizePath(id)` on the
    plugin's result (L466). `load` and `transform` then receive the `/` form.
  - **Build:** the id is not normalized. Rollup passes the returned id unchanged to `load` and
    `transform` and stores it in the module graph. If another importer resolves the same file
    through `vite:resolve`, the bundle gets two module instances of that file.
- The prediction in the brief ("Vite does NOT rewrite ids returned by plugins") is therefore only
  half right: it holds for build and is wrong for dev.
- **Linux test without backslashes:** the plugin returns `.../sub/./b.js`. On POSIX,
  `normalizePath` runs `posix.normalize`, which removes the `./` segment, so this shows whether
  Vite rewrites the id. Results:
  - Build: `load` and `transform` receive `.../sub/./b.js` unchanged, and the module graph holds
    two copies of `b.js`.
  - Dev: they receive `.../sub/b.js`, and the module graph holds one copy.
- **Verdict:** `confirmed by source` for both the dev and build behaviour, and confirmed on Linux
  through the dot-segment test. The `\` case is `undetermined (needs Windows run)`. The prediction
  derived from source: build passes `\` through and duplicates `b.js`; dev normalizes it to `/`.

## Claim 5: `normalizePath` converts `\` to `/`

- **Docs:** `normalizePath('foo\\bar') // 'foo/bar'`, with no condition attached.
- **Source:** `return path.posix.normalize(isWindows ? slash(id) : id)`
  ([utils.ts L229-231](https://github.com/vitejs/vite/blob/v7.3.6/packages/vite/src/node/utils.ts#L229-L231),
  dist config.js L1916-1918).
- This contradicts the docs on POSIX. Off Windows, `\` is left alone: the Linux probe observes
  `normalizePath('foo\\bar') === 'foo\\bar'`. On every platform the function also collapses `.`
  and `..` segments.
- **Verdict:** `confirmed by source` on Windows only. The docs example is `contradicted` on POSIX.

## Summary

| Claim | Verdict |
| --- | --- |
| 1 hook ids are `/` with volume kept | confirmed by docs; exceptions found in source (dev entry importer; plugin-returned ids during build); needs Windows run |
| 2 `config.root` is `/` | confirmed by source |
| 3 `\` and `/` inputs both accepted | undetermined (needs Windows run); source predicts yes |
| 4 plugin-returned `\` id is normalized? | confirmed by source: yes in dev, no in build (Rollup) |
| 5 `normalizePath` converts `\` to `/` | confirmed by source on Windows only; contradicted on POSIX |
