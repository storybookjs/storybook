# esbuild: path separators

Version checked: `esbuild@0.28.1` (repo root, `package.json` `"esbuild": "^0.28.0"`).
Probe: `poc/path-separators/probes/esbuild.mjs`.

Source links point at tag `v0.28.1` of `evanw/esbuild`. The JS package (`node_modules/esbuild/lib/main.js`) is
only a thin wrapper around the Go binary, so the path behavior lives in the Go source.

Key source facts used below:

- **`goFilepath`** ([internal/fs/filepath.go#L108-L111](https://github.com/evanw/esbuild/blob/v0.28.1/internal/fs/filepath.go#L108-L111)): esbuild's port of Go's `path/filepath`. On Windows `isPathSeparator` returns true for both `/` and `\`. `clean()` ends with `fp.fromSlash(...)` ([L436](https://github.com/evanw/esbuild/blob/v0.28.1/internal/fs/filepath.go#L436)), so every `Join` / `Dir` / `Abs` result is native (`\`) on Windows.
- **`MakePrettyPaths`** ([internal/resolver/resolver.go#L1093-L1122](https://github.com/evanw/esbuild/blob/v0.28.1/internal/resolver/resolver.go#L1093-L1122)) builds the relative "pretty" path with `fs.Rel(fs.Cwd(), path)` and then replaces `\` with `/`. The absolute variant (`Abs`) is **not** normalized.
- **Plugin-returned paths are not cleaned** ([internal/bundler/bundler.go#L1127-L1150](https://github.com/evanw/esbuild/blob/v0.28.1/internal/bundler/bundler.go#L1127-L1150)): the result is checked with `fs.IsAbs` and then used as-is.
- **Module dedupe key** ([bundler.go#L1311-L1317](https://github.com/evanw/esbuild/blob/v0.28.1/internal/bundler/bundler.go#L1311-L1317), used at [#L1548-L1552](https://github.com/evanw/esbuild/blob/v0.28.1/internal/bundler/bundler.go#L1548-L1552)): `strings.ReplaceAll(strings.ToLower(absPath), "\\", "/")`. Two spellings of one file become one module, and the first spelling seen is kept.

## 1. `onResolve` `importer` / `resolveDir` and `onLoad` `path` are absolute native paths

- **Docs** ([plugins: on-resolve arguments](https://esbuild.github.io/plugins/#on-resolve-arguments)):
  - `importer`: "This is the path of the module containing this import to be resolved. Note that this path is only guaranteed to be a file system path if the namespace is `file`."
  - `resolveDir`: "This is the file system directory to use when resolving an import path to a real path on the file system."
  - onLoad `path` ([on-load arguments](https://esbuild.github.io/plugins/#on-load-arguments)): "This is the fully-resolved path to the module. It should be considered a file system path if the namespace is `file`, but otherwise the path can take any form."
  - The docs never mention separators for these arguments. The only Windows wording is in on-resolve **results**: "Paths in the file namespace must be an absolute path for the current file system, so starting with a forward slash on Unix and with a drive letter on Windows". That sentence covers absoluteness, not which separator is used.
- **Source**: paths that esbuild resolves itself go through `loadAsFile`, which uses `fs.Dir` and `fs.Join` ([resolver.go#L1740-L1768](https://github.com/evanw/esbuild/blob/v0.28.1/internal/resolver/resolver.go#L1740-L1768)), so they come out native. `resolveDir` defaults to `fs.Dir(source.KeyPath.Text)` ([bundler.go#L1241-L1243](https://github.com/evanw/esbuild/blob/v0.28.1/internal/bundler/bundler.go#L1241-L1243)). For entry points, `resolveDir` is `fs.Cwd()` and `importer` is `""` ([bundler.go#L1873](https://github.com/evanw/esbuild/blob/v0.28.1/internal/bundler/bundler.go#L1873)).
- **Caveat**: `importer` is the importing module's key path, so it is native only if that module's path was native. See claim 5.
- **Verdict**: `confirmed by source` for paths esbuild resolves itself. The docs are silent on separators. The Windows run will check it (`esbuild.onResolve.*`, `esbuild.onLoad.path`).

## 2. `outputFiles[].path` is an absolute native path

- **Docs** ([api: write](https://esbuild.github.io/api/#write)): "The build API call can either write to the file system directly or return the files that would have been written as in-memory buffers." The example only logs `out.path` and never defines its format. `main.d.ts` L215-L221 declares `path: string` without comment.
- **Source**: `AbsPath: c.fs.Join(c.options.AbsOutputDir, chunk.finalRelPath)` ([internal/linker/linker.go#L770](https://github.com/evanw/esbuild/blob/v0.28.1/internal/linker/linker.go#L770)), and `outdir` goes through `validatePath`, which calls `fs.Abs` and therefore `clean` ([pkg/api/api_impl.go#L713-L722](https://github.com/evanw/esbuild/blob/v0.28.1/pkg/api/api_impl.go#L713-L722), [#L1291](https://github.com/evanw/esbuild/blob/v0.28.1/pkg/api/api_impl.go#L1291)). The path is native even when `outdir` is given in `/` form.
- **Verdict**: `confirmed by source`. The docs are silent.

## 3. Metafile `inputs` / `outputs` keys are relative to `absWorkingDir` and use `/`

- **Docs** ([api: metafile](https://esbuild.github.io/api/#metafile)): "All paths in the metafile are relative by default. If you would like them to be absolute paths instead, you can configure that with the abs paths setting." The docs do not say what the paths are relative to. [Working directory](https://esbuild.github.io/api/#working-directory) lists among the uses of the working directory "pretty-printing absolute paths as relative paths in log messages". [Abs paths](https://esbuild.github.io/api/#abs-paths) says relative paths "are necessary for build output to be reproducible across different machines and operating systems."
- **Source**: input keys come from `PrettyPaths.Select(MetafilePathStyle)` ([linker.go#L5983](https://github.com/evanw/esbuild/blob/v0.28.1/internal/linker/linker.go#L5983)). Output keys come from `MakePrettyPaths(c.fs, Join(AbsOutputDir, finalRelPath))` ([linker.go#L761-L763](https://github.com/evanw/esbuild/blob/v0.28.1/internal/linker/linker.go#L761-L763)). The relevant code comment ([resolver.go#L1102-L1107](https://github.com/evanw/esbuild/blob/v0.28.1/internal/resolver/resolver.go#L1102-L1107)): "These human-readable paths are used in error messages, comments in output files, source names in source maps, and paths in the metadata JSON file. These should be platform-independent so our output doesn't depend on which operating system it was run. Replace Windows backward slashes with standard forward slashes."
- **Exception (not in the original claim)**: with `absPaths: ['metafile']`, keys use `PrettyPaths.Abs`, which is **not** slash-normalized, so on Windows they would be native `C:\...`. The probe records this as `esbuild.metafile.absPaths`.
- **Verdict**: `confirmed by source`. The docs confirm "relative" but say nothing about separators. The Windows run will check it.

## 4. `entryPoints`, `absWorkingDir`, `outdir`, `alias` accept `\` and `/` on Windows

- **Docs**: silent on separators. [Working directory](https://esbuild.github.io/api/#working-directory) is used for "resolving relative paths given as API options to absolute paths". [Alias](https://esbuild.github.io/api/#alias): "the resulting import path is resolved in the working directory".
- **Source**: on Windows `isPathSeparator` and `isAbs` accept both separators ([filepath.go#L78-L111](https://github.com/evanw/esbuild/blob/v0.28.1/internal/fs/filepath.go#L78-L111)).
  - `absWorkingDir` must satisfy `isAbs`, and is then passed through `evalSymlinks` ([internal/fs/fs_real.go#L76-L105](https://github.com/evanw/esbuild/blob/v0.28.1/internal/fs/fs_real.go#L76-L105)).
  - `outdir` goes through `fs.Abs`.
  - Entry points go through `fs.Dir` / `fs.Base` and then the resolver ([bundler.go#L1873-L1903](https://github.com/evanw/esbuild/blob/v0.28.1/internal/bundler/bundler.go#L1873-L1903)).
  - An absolute import path goes to `loadAsFileOrDirectory`, which rebuilds the path with `fs.Join` ([resolver.go#L968-L985](https://github.com/evanw/esbuild/blob/v0.28.1/internal/resolver/resolver.go#L968-L985)).
  - Alias **keys** must be package-like. `C:\foo` and `/foo` are rejected ([api_impl.go#L478-L493](https://github.com/evanw/esbuild/blob/v0.28.1/pkg/api/api_impl.go#L478-L493)). Alias **values** may be either form.
- **Prediction**: both forms are accepted. A `/` entry point does **not** change the `onLoad` path format, which stays native because the resolver rebuilds it with `Join`. The entry point's own `onResolve` `args.path` is still the verbatim string ("This is the verbatim unresolved path from the underlying module's source code").
- **Verdict**: `undetermined (needs Windows run)`. The source strongly suggests both forms work. The probe runs every option alone and all four together in each form (`esbuild.input.<option>.<form>`).

## 5. `onResolve` returns a `/`-form path: what does `onLoad` get?

- **Docs**: only "must be an absolute path for the current file system". The docs say nothing about normalization.
- **Source**: there is no `Clean`. `ResolveResult{PathPair: {Primary: result.Path}}` is used verbatim ([bundler.go#L1127-L1150](https://github.com/evanw/esbuild/blob/v0.28.1/internal/bundler/bundler.go#L1127-L1150)).
  - **onLoad `path`**: the `/` form is kept as-is.
  - **Children of that module**: their `importer` is the `/` form, and their `resolveDir` is `fs.Dir(path)`, which is cleaned to native. So on Windows `importer` and `resolveDir` can use different separators.
  - **Same file imported elsewhere in native form**: the dedupe key merges the two into one module, and whichever spelling arrives first wins.
- **Verdict**: `confirmed by source` that the path is kept, not normalized. Which spelling wins under dedupe is `undetermined (needs Windows run)`. The probe records `esbuild.plugin.forwardPathKept` and `esbuild.plugin.forwardPath.childImporter`.

## 6. `transformSync` `sourcefile` passes through unchanged

- **Docs** ([api: sourcefile](https://esbuild.github.io/api/#sourcefile)): "This option sets the file name when using an input which has no file name. This happens when using the transform API and when using the build API with stdin. The configured file name is reflected in error messages and in source maps. If it's not configured, the file name defaults to `<stdin>`."
- **Source / probe**: the string is not resolved or normalized. `map.sources[0]` and `errors[0].location.file` equal the input exactly, including a backslash string on Linux.
- **Contradiction**: `code/core/src/bin/loader.ts` (L156-L161) calls `transformSync(rawSource, { loader, target, format, platform })` **without** `sourcefile`, and no file under `code/` passes `sourcefile` to esbuild. The claim that loader.ts uses it is wrong as of this checkout. Error messages and source maps from the loader say `<stdin>`.
- **Verdict**: passthrough is `confirmed by docs` and by the Linux probe. The premise that "loader.ts uses sourcefile" is `contradicted`.
