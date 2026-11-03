# Path-separator results

This page records the observed behavior from one Windows run: Windows 11 (build 26300), x64, Node 25.8.0, the repository's installed tool versions. 469 of 473 claims behaved as the docs and source predicted. The four that did not are marked **(unpredicted)** below. Raw values are in the `report-win32.json` from that run; the citations behind each prediction are in `docs/`.

"Native" means `C:\…` on Windows. Every tool below accepts `/`-separated absolute paths (`C:/…`) as input unless a row says otherwise.

## Tools that return `/`

| Tool | Returns `/` for | Exceptions on Windows |
| --- | --- | --- |
| pathe 1.1.2 and 2.0.3 | every function; drive letter uppercased | `delimiter` is `:` in 1.1.2 and in 2.0.3's default export (only 2.0.3's named export is `;`). `relative` is case-sensitive. 1.1.2 `basename('a/b/')` is `''`. |
| Vite 7 (build and dev) | hook ids, `importer`, module graph, `config.root` (also when `root` is given natively) | Build passes ids returned by plugins through unchanged, so returning a native or non-normalized id creates a second copy of the module. Dev normalizes them. The dev entry importer is native. |
| Vitest 5 | `testPath`, task/reporter file paths, `config.root`, `setupFiles`, transform ids | `import.meta.filename`/`dirname` and the injected `__filename`/`__dirname` are native. An absolute `include` glob written with `\` matches nothing. |
| TypeScript 6 | source-file names, diagnostics, `resolveModuleName`, `findConfigFile`, host callback arguments | `getRootFileNames()` returns roots as given; `ts.sys.resolvePath`, `realpath`, `getCurrentDirectory` are native. |
| tinyglobby | relative and absolute results | Treats `\` in a pattern as an escape: patterns built with `node:path` match nothing. |
| glob 10 with `posix: true` | results | Absolute results start with `//?/C:/`, which no `C:/` string starts with. |
| esbuild metafile | `inputs`/`outputs` keys (relative) | With `absPaths: ['metafile']` the keys are native. |
| git | all output | Pathspecs accept `\` and `/`, relative and absolute. |
| `import.meta.resolve` | `file:///C:/…` URLs | `fileURLToPath` of them is native. |

## Tools that return native paths

| Tool | Native even when given `C:/…` input | Notes |
| --- | --- | --- |
| `node:path` | `join`, `resolve`, `normalize`, `relative` | `dirname`, `basename`, `parse`, `format` keep the input's separators. `relative` is case-insensitive and returns the absolute target across drives. |
| Node built-ins | `process.cwd()`, `__dirname`, `import.meta.dirname`, `require.resolve`, `fileURLToPath`, `realpath*`, recursive `readdir` names | `os.tmpdir()`/`homedir()` return the environment variable verbatim. Recursive `readdir` from a `/` path gives a `/` `parentPath` for top-level entries and `\` for nested ones. `realpathSync` keeps the input's drive-letter case and 8.3 short names; `.native` does not. |
| Rollup 4, Rolldown 1 | all ids from their own resolution, including a `/` entry | A plugin returning the same file in the other form creates a duplicate module (observed: 2 copies). |
| esbuild | `onResolve` `importer`/`resolveDir`, `onLoad` `path`, `outputFiles[].path` | A `/` path returned by a plugin is kept, and the module is deduplicated with its native twin. |
| webpack 5 | `resource`, `resourcePath`, loader `context`, emitted paths | `compiler.context`, `outputPath` and `rootContext` echo the configured form. |
| oxc-resolver, empathic `find.*`, `createRequire().resolve` | results | empathic `walk.up` echoes the input form; its `last` stop dir is compared as a plain string, so a `/` start with a native `last` walks past it. |
| tsconfig-paths | `paths` targets | The part matched by `*` is pasted in verbatim, so results can mix `\` and `/`. |
| watchpack, chokidar | event paths, `getTimeInfoEntries()` file keys | — |
| glob 10 (default), fdir, `fs.globSync` | results | glob treats `\` in a pattern as an escape (`windowsPathsNoEscape` defaults to `false`), so `node:path`-built patterns match nothing. fdir returns `/` only with `withPathSeparator('/')`. `fs.globSync` accepts either separator in patterns. |

## Places where the form changes behavior

- **webpack loader dependencies (unpredicted).** `this.addDependency('C:/…')` and `this.addContextDependency('C:/…')` are not treated as absolute. webpack only accepts `/^(?:[a-z]:\\|\\\\|\/)/i` as absolute (`NormalModule.js`), so it removes the entry and joins it onto the module's directory, giving `…\src\sub\C:\…\a.js`. Watching for that file silently never fires. Pass native paths.
- **webpack `module.rules[].include` strings** are a plain `startsWith` against the native resource. A `C:/…` string never matches, and the schema accepts it without a warning.
- **watchpack file watches.** A file registered in `/` form never reports a change and reports a spurious `remove`. Directory watches in `/` form work, but report changes in the form they were given.
- **cmd built-ins (unpredicted).** `type` and `copy` fail with quoted `/` paths ("The system cannot find the file specified"). `dir` and `if exist` work only when quoted. Unquoted `/` paths fail in all of them. `node "C:/…"`, `cd "C:/…"`, `git -C C:/…` and `spawnSync` with `/` paths and `cwd` all work.
- **`PATH` splitting.** pathe 1.1.2's `delimiter` and 2.0.3's default export split `C:\…` entries apart. Use `node:path`'s `delimiter`.
- **ESM `import()` of an absolute path** fails in either form (`ERR_UNSUPPORTED_ESM_URL_SCHEME`); pass a `file://` URL.

## Rules that follow

1. Use `pathe` by default. Its output matches Vite, Vitest, TypeScript, tinyglobby, git and esbuild metafiles.
2. Before comparing a path with, or using it as a key next to, a value from the native-output tools above, normalize both sides with `pathe`'s `normalize` (or `resolve`). Equality, `startsWith`, `Map` keys and `split(sep)` are where Windows bugs come from, not which module built the path.
3. Give webpack loaders and plugins native paths for `addDependency`, `addContextDependency`, `fileDependencies` and `include` strings. Give watchpack file watches native paths.
4. In Vite plugins, return ids from `resolveId` in `/` form (`pathe` or Vite's `normalizePath`). In plain Rollup and Rolldown plugins, return native ids.
5. Keep `node:path` for `delimiter`/`PATH`, for paths interpolated into cmd built-ins, and where node's case-insensitive `relative` matters. Build glob and tinyglobby patterns with `pathe`; glob's `posix: true` absolute results start with `//?/`.
