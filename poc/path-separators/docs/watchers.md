# Watchers: watchpack and chokidar path separators

Probe: `poc/path-separators/probes/watchers.mjs`. Versions used (repo root): watchpack **2.5.2**, chokidar **4.0.3**.

Context: `code/core/src/core-server/utils/watch-story-specifiers.ts` keeps `node:path` because it "hands paths to watchpack, which matches native paths". That file builds every watched path with `node:path` (`resolve`/`join`), so it always registers native strings. It also converts event paths with `path.relative(workingDir, absolutePath)` before matching, which accepts either separator on Windows.

## Summary of the source reading

watchpack does **not** normalize the paths you register. It keeps each string as given and builds every path it discovers with `path.join(dir, name)`. On win32 `path.join` turns `/` into `\`. So:

- Paths watchpack **discovers** (files inside a watched directory) come out native.
- Paths watchpack **echoes** (the registered directory or file string) come out exactly as you gave them.
- Per-file lookups compare `toLowerCase(registered)` against `toLowerCase(path.join(...))`. A `files` entry in `/` form never matches on Windows.

chokidar normalizes every input to `/` (`unifyPaths` → `normalizePathToUnix`). On Windows it then runs `path.normalize` on every emitted path, and it keys `getWatched()` by `path.resolve(dir)`. So it accepts either form and always outputs native paths.

## Claim 1: watchpack `watch({ directories, files })` accepts both `\` and `/` on Windows

**Docs.** The [README at v2.5.2](https://github.com/webpack/watchpack/blob/v2.5.2/README.md) says nothing about separators for `files` or `directories`. Separators come up only for `ignored`: "For all cases expect the arbitrary function the path will have path separator normalized to '/'." That applies only to ignore matching (`normalizeSeparators` in `lib/index.js` L81-90).

**Source.** `node_modules/watchpack/lib/index.js` `watch()` (L308-453) stores each string verbatim as a map key. There is no normalization.

- **`directories`:** `getWatcherManager.js` `watchDirectory(directory)` creates `new DirectoryWatcher(manager, directory)`, which keeps `this.path = directoryPath` verbatim (`DirectoryWatcher.js` L208). The directory's own watcher is registered under `withoutCase(this.path)`. Events are dispatched with `forEachWatcher(this.path, …)`, which looks up the same string, so the key matches. The OS watch is `fs.watch(this.path)`, and Node on Windows accepts `/`. **Prediction: events fire for both forms.**
- **`files`:** `getWatcherManager.js` L52 `watchFile(file)` uses `path.dirname(file)`, and win32 `dirname` keeps `/`. The file's watcher is keyed by `withoutCase(file)` (`DirectoryWatcher.js` L493). Every file event or scan computes `target = path.join(this.path, filename)` (L598, L831), which is `\` on win32, and dispatches with `forEachWatcher(target, …)` → `withoutCase(target)` (L285). `c:/x/a.txt` never equals `c:\x\a.txt`. On top of that, the initial scan removes only native keys from `missingWatchers` (L855-868), so the `/`-form file watcher gets `initial-missing`. Watchpack turns that into a `remove` event (`index.js` WatchpackFileWatcher). **Prediction: on Windows a `/`-form `files` entry gets no `change` events and a spurious `remove` right after `watch()`.**
- Links: [lib/index.js](https://github.com/webpack/watchpack/blob/v2.5.2/lib/index.js), [lib/DirectoryWatcher.js](https://github.com/webpack/watchpack/blob/v2.5.2/lib/DirectoryWatcher.js), [lib/getWatcherManager.js](https://github.com/webpack/watchpack/blob/v2.5.2/lib/getWatcherManager.js).

**Verdict.** The `directories` half is `confirmed by source`. The `files` half is `contradicted` (by source): `/` form breaks on Windows. Both are `undetermined (needs Windows run)` for empirical confirmation. Probe ids: `watchpack.input.directories.{backslash,forward}`, `watchpack.input.files.{backslash,forward}`.

## Claim 2: watchpack output paths are native on Windows, even when registered with `/`

**Docs.** The README calls the `change`/`remove` argument "the changed file" and the `aggregated` sets "a Set of all changed files". It describes `collectTimeInfoEntries`/`getTimeInfoEntries` keys as "absolute path". It says nothing about separators.

**Source.**

- **`change` event for a directory watch:** `DirectoryWatcher.setFileTime` emits `target`, which is built by `path.join(this.path, filename)` (L598) and is therefore **native**. `WatchpackDirectoryWatcher` forwards it as `file` (`index.js` L216 → `_onChange` → `emit("change", file, …)` L537).
- **`change` event for a `files` watch:** `WatchpackFileWatcher` emits the **registered string verbatim** (`index.js` L169). This only matters for native input, since `/` input never fires (claim 1).
- **`aggregated` changes and removals:** `_onChange(item, …)` adds `item` (L542). For a directory watch `item` is the **registered directory string**, not the changed file. For a file watch it is the registered file string. So the sets **echo the input form**, and for directory watches they do not contain file paths at all. This contradicts both the README wording ("all changed files") and the claim.
- **`getTimeInfoEntries()` keys:** file keys come from `this.files` (built via `path.join`), so they are **native**. The watched directory's own key is `this.path` (L1064), the **string as given**.

**Verdict.** The `change` event file path half is `confirmed by source`. The `aggregated` sets and the directory's own `getTimeInfoEntries` key are `contradicted` (by source): they echo the registered form. All are `undetermined (needs Windows run)` empirically. Probe ids: `watchpack.output.change.*`, `watchpack.output.aggregated.*`, `watchpack.output.timeInfo.{file,dir}.*`, `watchpack.output.change.files.*`.

## Claim 3: event paths `startsWith(givenDir)` when the directory was given in `/` form

**Docs.** Silent.

**Source.** This follows from claim 2. On Windows the reported path is `C:\…\dir\file`, while `givenDir` is `C:/…/dir`, so the `startsWith` comparison is **false**. On POSIX, or with native input, it is true. Storybook's `watch-story-specifiers.ts` avoids the problem: it registers native paths and compares through `path.relative` plus `slash()`, never `startsWith` on raw watcher output.

**Verdict.** `confirmed by source` (breaks on Windows with `/` input); `undetermined (needs Windows run)`. Probe ids: `watchpack.matching.startsWith.*`, `chokidar.matching.startsWith.*`.

## Claim 4: chokidar accepts both forms and outputs native paths

**Docs.** The [README at 4.0.3](https://github.com/paulmillr/chokidar/blob/4.0.3/README.md) says `paths` is "(string or array of strings). Paths to files, dirs to be watched". It says `getWatched()` keys "are all the directories (using absolute paths unless the `cwd` option was used)". It does not mention separators.

**Source.** In [src/index.ts @ 4.0.3](https://github.com/paulmillr/chokidar/blob/4.0.3/src/index.ts) (installed as `node_modules/chokidar/index.js`):

- **Input:** `add()` runs `unifyPaths(paths)` → `normalizePathToUnix` = `toUnix(path.normalize(toUnix(p)))` (L87-112, L332). Every input becomes `/` on every platform, so both forms are accepted. Because of this, even a `\` string is accepted on POSIX. The probe does not test that, per the brief.
- **Output events:** `_emit()`: `if (isWindows) path = sysPath.normalize(path);` (L454-455). Events are **native on Windows**. `isWindows` is `process.platform === 'win32'` (`handler.js` L16).
- **`getWatched()` keys:** `_getWatchedDir(directory)` keys `_watched` by `sysPath.resolve(directory)` (L668). Keys are **native on Windows**.

**Verdict.** Input is `confirmed by source`, and so is native output for events and `getWatched()` keys. The README alone does not settle it; `undetermined (needs Windows run)` empirically. Probe ids: `chokidar.input.{directory,file}.*`, `chokidar.output.events.*`, `chokidar.output.getWatched.*`.

## Notes for the Windows run

- Every prediction in the probe comes from the source reading above, not from Linux output. The Linux run passes 18/18, and the Windows-specific variants (`*.backslash`, and `*.forward` with `/` input) are recorded as `skipped-on-posix` on Linux.
- The most interesting Windows results to check: `watchpack.input.files.forward` (predicted `{ modified: false, spuriousRemove: true }`) and `watchpack.output.aggregated.forward` (predicted to echo `C:/…`).
