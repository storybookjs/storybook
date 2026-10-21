# Resolvers: documentation findings

Subject: the module/file resolvers the repo calls: oxc-resolver, empathic, Node `require.resolve` /
`createRequire`, `import.meta.resolve`, and tsconfig-paths. Probe: `probes/resolvers.mjs`.
Versions on the Linux run: Node v22.22.0, oxc-resolver 11.21.2 (pinned in `code/core/package.json`),
empathic 2.1.0, tsconfig-paths 4.2.0.

The same question applies to each tool. What separator does the returned path use on Windows, and
what happens when the input is the forward-slash form of an absolute path (`C:/...`)? Storybook builds
such inputs with `pathe`.

## How the repo uses them

- **oxc-resolver**: `code/core/src/shared/open-service/services/module-graph/engine/dependency-graph/resolver-factory.ts`.
  L100 calls `new OxcResolverFactory({ tsconfig: 'auto', alias, conditionNames, extensions })`. L125 and
  L133 call `resolveFileAsync(from, specifier)`. The fallback `from` is `projectRootEntry`, which L107
  builds with **`pathe`** `join`, so on Windows the resolver gets a `C:/...` file path.
- **empathic**: `code/core/src/common/js-package-manager/JsPackageManagerFactory.ts` L61-65 calls
  `find.up(LOCKFILE, { cwd, last: root })`. `code/builders/builder-vite/src/vite-config.ts` L67 calls
  `find.any(DEFAULT_VITE_CONFIG_FILES, { cwd: projectRoot, last: root })`. In that file `projectRoot`
  comes from **pathe** `resolve` (L91, forward slashes), and `root = getProjectRoot()` comes from
  **node:path** `join` (`code/core/src/common/utils/paths.ts` L26/L36, native). The two use different
  forms on Windows (see claim 2b).
- **tsconfig-paths**: `code/presets/react-webpack/src/loaders/react-docgen-loader.ts` L175 calls
  `TsconfigPaths.createMatchPath(getTsconfigPathsBaseDir(...), tsconfig.paths, ['browser','module','main'])`.
  `addMatchAll` keeps its default `true`. The base dir comes from node:path `resolve`
  (`code/core/src/common/utils/tsconfig.ts` L95-98), so it is native.
- **import.meta.resolve**: there are many call sites, almost always wrapped in `fileURLToPath(...)`.
  Examples are `code/builders/builder-webpack5/src/index.ts` L39 and
  `code/addons/docs/src/preset.ts` L34.

## 1. oxc-resolver `ResolverFactory#sync` / `resolveFileSync` return native paths; a `/` input is normalized

- **Docs**: the README does not say which separator the result uses. It says only that `directory` must be
  "An **absolute** path to a directory" ([README L114](https://github.com/oxc-project/oxc-resolver/blob/v11.21.2/README.md)).
  The usage example asserts `resolve.sync(process.cwd(), "./index.js").path` equals `path.join(cwd, "index.js")`
  (README L60). That implies native output, but only for a native input.
- **Source** (all files are at tag `v11.21.2`):
  - [napi/src/lib.rs L191-192, L363](https://github.com/oxc-project/oxc-resolver/blob/v11.21.2/napi/src/lib.rs):
    the JS string goes straight into `PathBuf::from(directory)`. The result is
    `resolution.full_path().to_string_lossy()`, and the JS binding does not rewrite separators.
  - [src/lib.rs L314-333](https://github.com/oxc-project/oxc-resolver/blob/v11.21.2/src/lib.rs):
    `resolve_impl` returns `path = self.load_realpath(&cached_path)`. At L827-838, `load_realpath`
    calls `self.cache.canonicalize(..)` when `symlinks` is true, which is the default. With
    `symlinks: false` on Windows, it does this instead: "collect from components to normalize forward
    slashes to backslashes".
  - [src/cache/cache_impl.rs L89-99, L346-395](https://github.com/oxc-project/oxc-resolver/blob/v11.21.2/src/cache/cache_impl.rs):
    canonicalization rebuilds the path recursively from the root. Each component is `PathBuf::push`ed,
    which adds `\` on Windows. The result goes through `strip_windows_prefix` to drop `\\?\`.
  - [src/cache/cached_path.rs L225-236](https://github.com/oxc-project/oxc-resolver/blob/v11.21.2/src/cache/cached_path.rs):
    `normalize_root` on Windows turns a trailing `C:/` root into `C:\`.
  - Intermediate `CachedPath`s built by `normalize_with` (L184-222) keep the caller's prefix as is, so
    they can be mixed. Only the final `path` returned to JS is rebuilt.
- **Prediction**: output is native (`\`) for relative, bare and tsconfig-`paths` specifiers, whether
  the input is native or `C:/`. A `C:/` input gives the same string as the native one.

Verdict: **confirmed by source** for native output. The forward-slash input case is **undetermined
(needs Windows run)**: the docs say nothing, and only the source reading predicts `\`. Probe ids:
`oxc.*.native`, `oxc.*.forwardInput`, `oxc.forwardInput.sameStringAsNative`.

## 2. empathic `find.up` / `find.any` / `package.up` return native paths; with a `/` cwd?

- **Docs**: the [README](https://github.com/lukeed/empathic/blob/v2.1.0/readme.md) examples show only
  POSIX output (`//=> "/.../path/to/acme/package.json"`). The JSDoc says "@returns The absolute path to
  the item". Nothing is said about separators or Windows.
- **Source**: [src/find.ts L20, L49, L79, L102](https://github.com/lukeed/empathic/blob/v2.1.0/src/find.ts)
  build every result with node:path `join(dir, name)`, and win32 `join` normalizes to `\`. `package.up`
  is `find.up('package.json')`. The installed files match: `node_modules/empathic/find.mjs` L14, L33,
  L60, L80.
- **`walk.up`** ([src/walk.ts L27-41](https://github.com/lukeed/empathic/blob/v2.1.0/src/walk.ts)):
  it applies `absolute()` to the start dir, which leaves an already-absolute input unchanged
  (`resolve.ts`: `isAbsolute(input) ? input : resolve(...)`). It then calls `dirname()` repeatedly,
  and win32 `dirname` slices its input. So the directories come back **in the form of the input**:
  a `C:/` cwd produces `C:/` directories. Only the `find.*` results are re-normalized by `join`.

Verdict: `find.*` / `package.up` output native with any input: **confirmed by source**, docs silent.
`walk.up` follows its input: **confirmed by source**. Both still need the Windows run to observe them.

### 2b. `last` is compared as a plain string

`walk.up` loops `while (prev !== root)`, where `root = absolute(last)`. That is a plain string
comparison with no normalization or case folding. On Windows, if `cwd` is `C:/...` and `last` is
`C:\...` (or the reverse), the boundary never matches. The walk then continues to the drive root,
and `find.*` can return a file **above** `last`. This is exactly the shape of `vite-config.ts` L67
(pathe `projectRoot` against node:path `getProjectRoot()`). That code's own comment (L59-61) says it
uses `last` to avoid naming unrelated configs outside the project.

Verdict: **confirmed by source**. Impact on Windows: **undetermined (needs Windows run)**. Probe:
`empathic.find.up.last.mixedForm` (predicted `walked-past-last` on Windows).

## 3. `require.resolve` / `createRequire(...).resolve` return native paths; `/` in `paths` is accepted

- **Docs**: [modules.md, require.resolve](https://nodejs.org/docs/latest-v22.x/api/modules.html#requireresolverequest-options)
  says: "just return the resolved filename". `paths`: "Each of these paths is used as a starting point
  for the module resolution algorithm". Nothing is said about separators. The same page says "The
  relative paths of POSIX style are resolved in an OS independent fashion", and an example comment says
  "On Windows, this would resolve to .\path\myLocalModule". `module.createRequire(filename)` accepts
  "a file URL object, file URL string, or absolute path string".
- **Source** ([lib/internal/modules/cjs/loader.js @ v22.22.0](https://github.com/nodejs/node/blob/v22.22.0/lib/internal/modules/cjs/loader.js)):
  `Module._findPath` L723 does `const basePath = path.resolve(curPath, request)` and then
  `toRealPath` (fs.realpathSync). `Module._nodeModulePaths` (Windows branch, L785-792) starts with `from = path.resolve(from)`.
  For the `paths` option, `_resolveFilename` L1309-1320 sends each entry through `_nodeModulePaths`.
  For a relative request it uses the entry directly as `curPath`, and `path.resolve` normalizes it at L723.
  `createRequireFromPath` (L1872-1888) only checks `path.isAbsolute`, and `C:/x` passes that check on win32.

Verdict: **confirmed by source**. The docs only imply native output, through the `.\path\...` example.
A `/` input is predicted to give native `\` output. Probe ids: `node.createRequire.*`,
`node.require.resolve.paths.*`.

## 4. `import.meta.resolve` returns `file:///C:/...`; `fileURLToPath` of it is native

- **Docs**: [esm.md, import.meta.resolve](https://nodejs.org/docs/latest-v22.x/api/esm.html#importmetaresolvespecifier):
  "Returns: <string> The absolute URL string that the specifier would resolve to". Example:
  `// file:///app/node_modules/component-lib/asset.css`.
  [url.md, fileURLToPath](https://nodejs.org/docs/latest-v22.x/api/url.html#urlfileurltopathurl-options):
  "Returns: <string> The fully-resolved platform-specific Node.js file path". Example:
  `fileURLToPath('file:///C:/path/'); // Correct: C:\path\ (Windows)`. pathToFileURL's example gives
  `file:///C:/... (Windows)`.
- The docs do not show `import.meta.resolve` producing a Windows URL directly. The `file:///C:/` shape
  follows from WHATWG file URLs and the `pathToFileURL` example.

Verdict: **confirmed by docs**. Probe ids: `node.importMetaResolve.*` (URL shape, forward-only
separators, native after `fileURLToPath`).

## 5. tsconfig-paths `createMatchPath` returns native paths; with a `/` absoluteBaseUrl?

- **Docs**: the [README](https://github.com/dividab/tsconfig-paths/blob/v4.2.0/README.md#creatematchpath)
  says createMatchPath "will handle resolving paths to absolute form", and the matcher "@returns the
  found path". Nothing is said about separators. The README does not mention that the extension is
  stripped from the result either.
- **Source** (at tag `v4.2.0`):
  - [src/mapping-entry.ts L36](https://github.com/dividab/tsconfig-paths/blob/v4.2.0/src/mapping-entry.ts):
    each explicit mapping is `path.resolve(absoluteBaseUrl, pathToResolve)`, so it is native whatever
    the base form is.
  - **L45**: the implicit match-all is `` `${absoluteBaseUrl.replace(/\/$/, "")}/*` ``, built by string
    concatenation. A native base gives `C:\proj/*`, which is mixed. A `C:/` base stays forward.
  - [src/try-path.ts L35](https://github.com/dividab/tsconfig-paths/blob/v4.2.0/src/try-path.ts):
    `physicalPathPattern.replace("*", starMatch)` splices the specifier's subpath, with its `/`,
    into the native pattern. `'@/nested/deep/b'` therefore resolves to `C:\proj\src\nested/deep/b`
    (mixed). File and extension hits return that string with the extension removed
    (`getStrippedPath` / `removeExtension`). Only index and package hits go through `path.join`
    (L44, L46, L61), which normalizes them.
  - Installed copies: `node_modules/tsconfig-paths/lib/mapping-entry.js` L26, L35 and `lib/try-path.js`
    L26, L31, L33, L46-55.

Verdict: the claim as stated is **contradicted (by source)**. The output is native only when the
specifier's star match has no `/` (`@/a`) or the hit is an index file. Nested subpaths give
**mixed** output on Windows. The match-all entry gives mixed output with a native base, or forward
output with a `C:/` base. Probe ids: `tsconfigPaths.match.{file,nestedSubpath,index,matchAll}.{native,forwardInput}`.
The Windows run will confirm or refute this.

## Summary

| Claim | Verdict |
| --- | --- |
| 1 oxc-resolver output native | confirmed by source; `/` input: undetermined (needs Windows run), predicted native |
| 2 empathic `find`/`package` native | confirmed by source; `walk.up` follows input; `last` is a string compare (2b) |
| 3 require.resolve / createRequire native | confirmed by source (docs imply it) |
| 4 import.meta.resolve URL, fileURLToPath native | confirmed by docs |
| 5 tsconfig-paths native | contradicted (by source): nested subpaths and match-all give mixed paths on Windows |
