# Glob libraries: path separators (`globs`)

Probe: `poc/path-separators/probes/globs.mjs`. Fixture: `src/a.ts`, `src/sub/b.ts`, `src/sub/c.stories.ts`.

Installed versions (repo root, also what `code/core` resolves): glob 10.5.0 (path-scurry 1.11.1),
tinyglobby 0.2.17, fdir 6.5.0, pathe 2.0.3, Node v22.22.0 (where the Linux run happened).

## 1. glob: output is native by default, `/` with `posix: true`

**Claim.** `globSync`/`glob` return `\`-separated paths on Windows by default, for relative results
and with `absolute: true`. With `posix: true` they use `/`.

**Docs.** [glob README v10.5.0, `posix`](https://github.com/isaacs/node-glob/blob/v10.5.0/README.md):
"`posix` Set to true to use `/` as the path separator in returned results. On posix systems, this has
no effect. On Windows systems, this will return `/` delimited path results, and absolute paths will
be returned in their full resolved UNC path form, eg insted of `'C:\\foo\\bar'`, it will return
`//?/C:/foo/bar`." The README never states the default separator outright. It follows from the
`posix` description and from `dotRelative`: "Prepend all relative path strings with `./` (or `.\` on
Windows)".

**Source.** `node_modules/glob/dist/esm/walker.js:33`:
`this.#sep = !opts.posix && opts.platform === 'win32' ? '\\' : '/';`. Lines 161 and 165 use
`e.fullpath()`/`e.relative()` (native) unless `posix` is set, then `fullpathPosix()`/`relativePosix()`.
`node_modules/glob/node_modules/path-scurry/dist/esm/index.js:471-489`: on Windows `fullpathPosix()`
returns `` `//?/${p}` `` for a drive-letter root.

**Caveat.** With `absolute: true, posix: true` on Windows you get `//?/C:/...`, not `C:/...`. That
string will not `startsWith()` a `C:/...` path built with pathe. The probe checks this with
`glob.globSync.absolute.posix.uncPrefix`.

**Verdict:** confirmed by docs and source (the default is implicit in the docs, explicit in the
source). The `//?/` UNC form is confirmed by docs.

## 2. glob: patterns must use `/`; `\` is an escape unless `windowsPathsNoEscape`

**Claim.** A pattern containing `\` is treated as escapes on Windows unless
`windowsPathsNoEscape: true`. The option defaults to false on Windows too.

**Docs.** [README "Windows" section](https://github.com/isaacs/node-glob/blob/v10.5.0/README.md#windows):
"**Please only use forward-slashes in glob expressions.** ... Back-slashes will always be interpreted
as escape characters, not path separators." The `windowsPathsNoEscape` entry says: "Use `\\` as a path
separator _only_, and _never_ as an escape character. If set, all `\\` characters are replaced with
`/` in the pattern. ... allows matching with patterns constructed using `path.join()` and
`path.resolve()` on Windows platforms". No default is documented, but nothing makes it
platform-dependent.

**Source.** `node_modules/glob/dist/esm/glob.js:100-106`:
`this.windowsPathsNoEscape = !!opts.windowsPathsNoEscape || opts.allowWindowsEscape === false;`. So the
default is `false` on every platform, and when the option is set the `\`→`/` rewrite happens on every
platform. Linux confirms this: `'src\\**\\*.ts'` matches 0 files by default and 3 with the option.

**Probe matrix** (Windows prediction):

| pattern built with | default | `windowsPathsNoEscape` |
| --- | --- | --- |
| `node:path` `join` (absolute or relative) | 0 matches | 3 |
| `pathe` `join` | 3 | 3 |
| manual `/` (`toForward(workDir)` + `/src/**/*.ts`) | 3 | 3 |

Each relative pattern is run with `cwd` in native form and in forward-slash form. The prediction is
that `cwd` accepts both and the output stays native either way. The docs say `cwd` is "a string path
or a `file://` URL". path-scurry resolves it.

**Verdict:** confirmed by docs and source. The default `false` is confirmed by source. Whether
`node:path` patterns fail on Windows needs the Windows run (undetermined).

## 3. tinyglobby: always `/`

**Claim.** tinyglobby returns `/` on every platform, both relative and with `absolute: true`.

**Docs.** The [documentation](https://superchupu.dev/tinyglobby/documentation) does not say which
separator is returned. It only says "`absolute`: Whether to return absolute paths". The
[comparison page](https://superchupu.dev/tinyglobby/comparison) says "tinyglobby always produces the
same paths format" and "The format of the results is not affected in any way by the patterns used".
The [README @0.2.17](https://github.com/SuperchupuDev/tinyglobby/blob/0.2.17/README.md) says it is
"meant to behave the same way" as fast-glob, which documents `/`-only output. The docs say nothing
about `\` in patterns, apart from offering `convertPathToPattern` and `escapePath` ("Converts a path to
a pattern depending on the platform").

**Source.** `node_modules/tinyglobby/dist/index.mjs`:
- line 277: `cwd` is resolved and then `.replace(BACKSLASHES, "/")`.
- line 244: fdir is created with `pathSeparator: "/"`.
- line 219: picomatch runs with `posix: true`, so `\` in patterns is an escape on every OS.
- line 135 (`ESCAPING_BACKSLASHES`) and lines 89-90 (`convertWin32PathToPattern`): only
  `convertPathToPattern` turns a Windows path's `\` into `/`.

**Prediction.** Output is `/` on all platforms and for either `cwd` form. A `node:path` `join` pattern
gives 0 matches on Windows. `pathe`, manual `/` and `convertPathToPattern(workDir) + '/src/**/*.ts'`
each give 3. `'src\\**\\*.ts'` gives 0 everywhere.

**Verdict:** output confirmed by source (the docs only imply it). Rejection of `\` in patterns is
confirmed by source on POSIX; on Windows it is undetermined (needs Windows run).

## 4. fdir: `path.sep` by default, configurable

**Claim.** fdir's output separator.

**Docs.** [documentation.md @v6.5.0](https://github.com/thecodrr/fdir/blob/v6.5.0/documentation.md):
- `withPathSeparator`: "Use this to set the path separator in the output".
- `withFullPaths`: "get full absolute paths in the output. By default, fdir returns filenames".
- `withBasePath`: "if you crawl `node_modules`, the output will contain only the filenames".

The documentation does not give the default separator.

**Source.** `node_modules/fdir/dist/index.mjs`:
- line 451: the Builder default is `pathSeparator: sep` (from `node:path`), so it is native.
- lines 16-30: `normalizePath` runs `convertSlashes(root, pathSeparator)` on the root. A `C:/...` root
  therefore still produces `\` output on Windows. On Windows, a root that contains `/` is also
  `path.normalize`d.

**Prediction.** On Windows, `withFullPaths`, `withBasePath` and `withRelativePaths` all produce `\`
whichever root form is passed. With `withPathSeparator('/')` the output is `/`. The default output is
bare filenames.

**Verdict:** confirmed by source (the docs are silent on the default).

## 5. `node:fs` `globSync`

**Claim.** The output format of `fs.globSync`.

**Docs.** [fs.md @v22.22.0](https://github.com/nodejs/node/blob/v22.22.0/doc/api/fs.md#fsglobsyncpattern-options):
added in v22.0.0 and stable since v22.17.0. It "Returns: {string\[]} paths of files that match the
pattern". The docs are silent about separators, Windows and `\`. There is no `absolute` option; an
absolute pattern yields absolute results.

**Source.** [lib/internal/fs/glob.js @v22.22.0](https://github.com/nodejs/node/blob/v22.22.0/lib/internal/fs/glob.js):
- line 21 imports `join` etc. from the platform `path` module.
- line 588: `const result = join(path, p);`, so results are native (`\` on Windows).
- line 103: Minimatch is created with `windowsPathsNoEscape: true`. In the vendored
  [deps/minimatch/index.js:1056-1059](https://github.com/nodejs/node/blob/v22.22.0/deps/minimatch/index.js)
  this rewrites every `\` to `/` on every platform.

**Surprise (seen on Linux).** `fs.globSync('src\\**\\*.ts')` matches all 3 files on Linux. With Node's
glob you cannot escape glob characters with `\` on any OS. This is the opposite of glob and
tinyglobby.

**Verdict:** native output is confirmed by source. Acceptance of `\` patterns is confirmed by source
and by the Linux run. Native `\` output on Windows is undetermined (needs Windows run).

## Repo usages (`code/`, non-test)

None of these pass `posix: true`, so on Windows all of them get native `C:\...` results:

| file | call | notes |
| --- | --- | --- |
| `code/core/src/common/js-package-manager/JsPackageManager.ts:930` | `globSync('**/package.json', { cwd: projectRoot, absolute: true, ignore })` | Results go through pathe `dirname` (which outputs `/`) and are then compared with `storyPath.startsWith(packageDir)`. This works only if `storiesPaths` are also `/`-form. |
| `code/core/src/common/js-package-manager/NPMProxy.ts:218` | `globSync(workspacePatterns + '/package.json', { cwd, absolute: true, ignore })` | The patterns come from package.json `workspaces`, which already use `/`. |
| `code/core/src/common/utils/validate-configuration-files.ts:16` | `glob(slash(resolve(configDir, 'main{...}')), { cwd })` | The pattern is slashed, so it is fine. The result is a native absolute path. |
| `code/core/src/core-server/utils/remove-mdx-entries.ts:31` | `glob(slash(absolutePattern), { ...commonGlobOptions, follow: true })` | Results go to pathe `relative`, which normalizes them. |
| `code/core/src/core-server/utils/ghost-stories/get-candidates.ts:149` | `glob(globPattern, { cwd, absolute: true, ignore })` | Native absolute output. |

tinyglobby users (`/` output):
- `code/core/src/common/utils/paths.ts:68`: `globSync(matchers, { cwd: directory, absolute: true })`.
- `code/lib/codemod/src/index.ts:64`: `tinyglobby([normalize(glob), ...])`. Here `normalize` comes from
  pathe, so the pattern keeps `/`.

## Verdicts

| claim | verdict |
| --- | --- |
| 1 glob native output / `posix` → `/` | confirmed by docs and source (`posix` + absolute → `//?/C:/…`) |
| 2 glob `\` is an escape, `windowsPathsNoEscape` defaults to false | confirmed by docs and source; Windows match counts need the Windows run |
| 3 tinyglobby always `/` | confirmed by source (docs only imply it) |
| 4 fdir default `path.sep` | confirmed by source |
| 5 `fs.globSync` native output | confirmed by source; `\` in patterns is always a separator (confirmed on Linux) |
