# Node built-ins: separator style of returned paths and accepted inputs

Node version checked: **v22.22.0** (the one installed here). Docs are cited from
`https://nodejs.org/docs/v22.22.0/api/…`; source from `https://github.com/nodejs/node/blob/v22.22.0/…`
(libuv is the copy vendored at `deps/uv` in that tag). Probe: `probes/node-builtins.mjs`.

Summary: Node's documentation almost never states separator style explicitly. Most "returns a
native path" claims follow from the source (`path.resolve`/`path.join` from `path.win32` on
Windows, or Win32 APIs that return `\`). The main exceptions to "Node returns native paths" are
**values copied verbatim from the environment or from the caller's input**:
`os.tmpdir()`, `os.homedir()`, and top-level `Dirent.parentPath` of a (recursive) `readdir`.

---

## 1. Paths returned by process / os / module metadata

### `process.cwd()` — native

- Docs ([process.cwd()](https://nodejs.org/docs/v22.22.0/api/process.html#processcwd)): "returns the
  current working directory of the Node.js process." Silent on format.
- Source: `process.cwd` is libuv `uv_cwd` → `GetCurrentDirectoryW` on Windows
  ([lib/internal/bootstrap/switches/does_own_process_state.js](https://github.com/nodejs/node/blob/v22.22.0/lib/internal/bootstrap/switches/does_own_process_state.js#L113-L130)
  only caches it). Windows normalizes the current directory when it is set (see
  [File path formats on Windows](https://learn.microsoft.com/en-us/dotnet/standard/io/file-path-formats#canonicalize-separators):
  "All forward slashes (`/`) are converted into the standard Windows separator, the back slash"),
  so even `process.chdir('C:/x')` or `spawn(..., { cwd: 'C:/x' })` should yield `C:\x`.
- Probe: `node.process.cwd`, `node.process.chdir.forwardInput`, and `cwd` in
  `node.child_process.spawnSync.forward`.
- Verdict: **undetermined (needs Windows run)** — strongly expected; docs silent, Win32 behavior.

### `os.tmpdir()` — native only if the env var is

- Docs ([os.tmpdir()](https://nodejs.org/docs/v22.22.0/api/os.html#ostmpdir)): "On Windows, the
  result can be overridden by `TEMP` and `TMP` environment variables … If neither is set, it
  defaults to `%SystemRoot%\temp` or `%windir%\temp`."
- Source ([lib/os.js#L180-L191](https://github.com/nodejs/node/blob/v22.22.0/lib/os.js#L180-L191)):
  returns `process.env.TEMP || process.env.TMP || …` **verbatim**, only stripping one trailing `\`.
  No normalization. On Windows CI it is commonly an 8.3 short path such as
  `C:\Users\RUNNER~1\AppData\Local\Temp`.
- Probe: `node.os.tmpdir` (real value), `node.os.tmpdir.envVerbatim` (child process with
  `TEMP=TMP=<…/fake-env-dir>` in `/` form ⇒ `/` result). Raw `realpath` of the tmpdir is in
  `raw.realpath.tmpdir`.
- Verdict: **confirmed by source**, with a caveat that **contradicts the blanket claim**: it is
  native only because the OS sets `TEMP` natively; a `/` value (e.g. set by a script or some
  shells) passes through unchanged.

### `os.homedir()` — native only if `USERPROFILE` is

- Docs ([os.homedir()](https://nodejs.org/docs/v22.22.0/api/os.html#oshomedir)): "On Windows, it
  uses the `USERPROFILE` environment variable if defined. Otherwise it uses the path to the profile
  directory of the current user."
- Source ([deps/uv/src/win/util.c#L976-L993](https://github.com/nodejs/node/blob/v22.22.0/deps/uv/src/win/util.c#L976-L993)):
  `uv_os_getenv("USERPROFILE", …)` returned as-is.
- Probe: `node.os.homedir`, `node.os.homedir.envVerbatim`.
- Verdict: **confirmed by docs** (verbatim env use) — same caveat as `tmpdir`.

### CJS `__dirname` / `__filename`, `require.resolve()` — native

- Docs ([modules: `__filename`](https://nodejs.org/docs/v22.22.0/api/modules.html#__filename)):
  "the current module file's absolute path with symlinks resolved." Silent on separators.
- Source: the CJS loader resolves via `path.resolve` and then
  `toRealPath` → `fs.realpathSync` (JS implementation)
  ([lib/internal/modules/helpers.js#L60-L61](https://github.com/nodejs/node/blob/v22.22.0/lib/internal/modules/helpers.js#L60-L61)),
  which starts with `path.resolve(p)` ([lib/fs.js#L2729](https://github.com/nodejs/node/blob/v22.22.0/lib/fs.js#L2729)),
  so the result uses `\` even for a `require('C:/x/y.cjs')`. Because it is the **JS** realpath, 8.3
  short names and the caller's drive-letter case are **not** canonicalized (see §3).
- Probe: `node.cjs.__dirname__filename.native|forwardInput`, `node.cjs.require.resolve.forwardInput`.
- Verdict: **confirmed by source**.

### ESM `import.meta.dirname` / `import.meta.filename` — native

- Docs ([esm: import.meta.filename](https://nodejs.org/docs/v22.22.0/api/esm.html#importmetafilename)):
  "The full absolute path and filename of the current module, with symlinks resolved. This is the
  same as the `url.fileURLToPath()` of the `import.meta.url`." `import.meta.dirname` is "the same
  as the `path.dirname()` of the `import.meta.filename`".
- Since `fileURLToPath` returns a native path on Windows (§2), these are native. The ESM resolver
  also uses JS `realpathSync` + `pathToFileURL`
  ([lib/internal/modules/esm/resolve.js#L278-L284](https://github.com/nodejs/node/blob/v22.22.0/lib/internal/modules/esm/resolve.js#L278-L284)).
- Probe: `node.esm.importMeta.native|forwardInput`.
- Verdict: **confirmed by docs** (via the documented `fileURLToPath` equivalence).

### `process.execPath` — native

- Docs ([process.execPath](https://nodejs.org/docs/v22.22.0/api/process.html#processexecpath)):
  "the absolute pathname of the executable … Symbolic links, if any, are resolved." Example is POSIX
  only. Comes from libuv `uv_exepath` (`GetModuleFileNameW` on Windows).
- Verdict: **undetermined (needs Windows run)** — docs silent on separators; expected native.

### `process.argv[1]` — native, even if invoked with `/`

- Docs ([process.argv](https://nodejs.org/docs/v22.22.0/api/process.html#processargv)): "The second
  element will be the path to the JavaScript file being executed." Silent on format.
- Source ([lib/internal/process/pre_execution.js#L264-L275](https://github.com/nodejs/node/blob/v22.22.0/lib/internal/process/pre_execution.js#L264-L275)):
  `process.argv[1] = path.resolve(process.argv[1])` — so `node C:/x/s.mjs` gives `argv[1] === 'C:\\x\\s.mjs'`.
- Probe: `node.process.argv1` (this process), `argv1` in `node.child_process.spawnSync.forward`.
- Verdict: **confirmed by source**.

## 2. `fileURLToPath` / `pathToFileURL`

- Docs ([url.fileURLToPath](https://nodejs.org/docs/v22.22.0/api/url.html#urlfileurltopathurl-options)):
  "Returns: The fully-resolved platform-specific Node.js file path", with the example
  `fileURLToPath('file:///C:/path/') // Correct: C:\path\ (Windows)`. Since v22.1.0 an
  `options.windows` flag forces win32 (`true`) or POSIX (`false`) conversion on any platform.
  [fs › File paths › Platform-specific considerations](https://nodejs.org/docs/v22.22.0/api/fs.html#file-url-paths):
  "`file:///C:/tmp/hello => C:\tmp\hello`".
- Source ([lib/internal/url.js#L1459-L1491](https://github.com/nodejs/node/blob/v22.22.0/lib/internal/url.js#L1459-L1491)):
  `getPathFromURLWin32` replaces every `/` with `\`, keeps the drive letter's case as written
  (no upper-casing). `pathToFileURL` runs `path.win32.resolve` first
  ([#L1634-L1639](https://github.com/nodejs/node/blob/v22.22.0/lib/internal/url.js#L1634-L1639)),
  so `C:/x` and `C:\x` give the same href. On POSIX, `fileURLToPath('file:///C:/x/y')` is `/C:/x/y`.
- Probe: `node.url.roundtrip`, `node.url.pathToFileURL.forwardInput`, `node.url.fileURLToPath.driveUrl`,
  `node.url.windowsOption` (platform-independent check of the win32 conversion, incl. lowercase drive).
- Verdict: **confirmed by docs**.

## 3. `fs.realpathSync` / `.native` / `fs.promises.realpath`

- Docs: [fs.realpath](https://nodejs.org/docs/v22.22.0/api/fs.html#fsrealpathpath-options-callback)
  (and `realpathSync`, which defers to it): "This function behaves like realpath(3), with some
  exceptions: 1. **No case conversion is performed on case-insensitive file systems.**"
  [fs.realpathSync.native](https://nodejs.org/docs/v22.22.0/api/fs.html#fsrealpathsyncnativepath-options):
  "Synchronous realpath(3)." [fsPromises.realpath](https://nodejs.org/docs/v22.22.0/api/fs.html#fspromisesrealpathpath-options):
  "using the same semantics as the `fs.realpath.native()` function." Separators and 8.3 names: silent.
- Source:
  - JS `realpathSync` ([lib/fs.js#L2722-L2851](https://github.com/nodejs/node/blob/v22.22.0/lib/fs.js#L2722-L2851)):
    `p = pathModule.resolve(p)` (⇒ `\`, drive-letter case **as given** — `path.win32.resolve('c:/x')`
    is `c:\x`), then walks components with `lstat`, only rewriting symlinks. So it keeps the input's
    drive case, directory-name case and **8.3 short names** (`RUNNER~1`).
  - `.native` ([#L2858-L2863](https://github.com/nodejs/node/blob/v22.22.0/lib/fs.js#L2858-L2863))
    and `promises.realpath` ([lib/internal/fs/promises.js#L1160-L1167](https://github.com/nodejs/node/blob/v22.22.0/lib/internal/fs/promises.js#L1160-L1167))
    both call `binding.realpath` → libuv `fs__realpath_handle` →
    `GetFinalPathNameByHandleW(…, VOLUME_NAME_DOS)` and strip the `\\?\` prefix
    ([deps/uv/src/win/fs.c#L2952-L2999](https://github.com/nodejs/node/blob/v22.22.0/deps/uv/src/win/fs.c#L2952-L2999)).
    That returns the on-disk name (canonical case, long names), with `\`.
- Probe: `node.fs.realpath.forwardInput` (all three with `/` input), Windows-only
  `node.fs.realpath.lowercaseDrive`, `node.fs.realpath.componentCase`, `node.fs.realpath.shortName`
  (8.3 path obtained from PowerShell `Scripting.FileSystemObject.ShortPath`; if 8.3 generation is
  disabled on the volume it records `no-short-name-available`), plus raw values for `os.tmpdir()`.
- Verdict: separators — **confirmed by source**. Case/8.3 behaviour (JS keeps input, native/promises
  canonicalize) — **undetermined (needs Windows run)**; the "no case conversion" part for JS is
  confirmed by docs, the long-name expansion by `GetFinalPathNameByHandleW` is not documented by
  Microsoft in those words. Important consequence: `realpathSync(x) !== realpathSync.native(x)` on
  Windows is possible even when both are "native".

## 4. Recursive `readdir`: names and `Dirent.parentPath`

- Docs ([fs.readdirSync](https://nodejs.org/docs/v22.22.0/api/fs.html#fsreaddirsyncpath-options)):
  "`recursive` … it will list all files, sub files, and directories." [dirent.parentPath](https://nodejs.org/docs/v22.22.0/api/fs.html#direntparentpath):
  "The path to the parent directory of the file". Silent on separator style and on whether the
  input string is normalized.
- Source:
  - names: `pathModule.relative(basePath, pathModule.join(currentPath, name))`
    ([lib/fs.js#L1471-L1482](https://github.com/nodejs/node/blob/v22.22.0/lib/fs.js#L1471-L1482);
    promises [#L912-L918](https://github.com/nodejs/node/blob/v22.22.0/lib/internal/fs/promises.js#L912-L918))
    ⇒ nested names are `a\b\c.txt` on Windows regardless of the input form.
  - `parentPath`: `new Dirent(name, type, path)` with `path` = the directory string being read
    ([lib/internal/fs/utils.js#L291-L316](https://github.com/nodejs/node/blob/v22.22.0/lib/internal/fs/utils.js#L291-L316)).
    For the root that is the caller's string **verbatim** (`readdirSync` passes `getValidatedPath(path)`
    unchanged, [lib/fs.js#L1586-L1594](https://github.com/nodejs/node/blob/v22.22.0/lib/fs.js#L1586-L1594));
    for subdirectories it is `pathModule.join(currentPath, name)`
    ([lib/fs.js#L1454-L1469](https://github.com/nodejs/node/blob/v22.22.0/lib/fs.js#L1454-L1469)).
    So with input `C:/x/rd`, top-level dirents report `C:/x/rd` and nested ones `C:\x\rd\a\b` —
    **mixed styles within one result**.
- Probe: `node.fs.readdirSync.recursive.names.*`, `node.fs.{readdirSync,promises.readdir}.recursive.parentPath.*`.
- Verdict: native when given native input — **confirmed by source**; **partly contradicted** for
  `/` input on Windows (top-level `parentPath` stays `/`). Needs Windows run to observe.

## 5. Inputs: fs with `/` and mixed separators; `import()` of raw absolute paths

### fs accepts `C:/…` and mixed separators on Windows

- Node docs: [fs › String paths](https://nodejs.org/docs/v22.22.0/api/fs.html#string-paths) only
  shows POSIX examples; [path.sep](https://nodejs.org/docs/v22.22.0/api/path.html#pathsep) says "On
  Windows, both the forward slash (`/`) and backward slash (`\`) are accepted as path segment
  separators; however, the `path` methods only add backward slashes" (about `path`, not fs).
- Source: `lib/fs.js` does not namespace or rewrite paths (no `toNamespacedPath` calls); libuv
  hands the UTF-16 path to Win32 (`CreateFileW` etc.), which normalizes it. Microsoft
  ([File path formats on Windows](https://learn.microsoft.com/en-us/dotnet/standard/io/file-path-formats#canonicalize-separators)):
  "Almost all paths passed to Windows APIs are normalized … All forward slashes (`/`) are converted
  into the standard Windows separator", except paths starting exactly with `\\?\`
  ([Skip normalization](https://learn.microsoft.com/en-us/dotnet/standard/io/file-path-formats#skip-normalization)).
- Probe: `node.fs.input.native|forward|mixed` (mkdir/write/exists/stat/read).
- Verdict: **confirmed by docs** (Microsoft, Win32 normalization) — Node docs silent.

### `import()` of a raw absolute path fails on Windows

- Docs: [esm › Terminology](https://nodejs.org/docs/v22.22.0/api/esm.html#terminology) — absolute
  specifiers are like `'file:///opt/nodejs/config.js'`; "All other specifier resolutions are always
  only resolved with the standard relative URL resolution semantics."
  [esm › URLs](https://nodejs.org/docs/v22.22.0/api/esm.html#urls): "ES modules are resolved and
  cached as URLs … `file:`, `node:`, and `data:` URL schemes are supported."
  [esm › file: URLs](https://nodejs.org/docs/v22.22.0/api/esm.html#file-urls): "The volume root may
  be referenced via `/`, `//`, or `file:///` … it is recommended to use `url.pathToFileURL` when
  importing a path." [esm › Mandatory file extensions](https://nodejs.org/docs/v22.22.0/api/esm.html#mandatory-file-extensions):
  extension required for "relative or absolute specifiers". [errors › ERR_UNSUPPORTED_ESM_URL_SCHEME](https://nodejs.org/docs/v22.22.0/api/errors.html#err_unsupported_esm_url_scheme):
  "`import` with URL schemes other than `file` and `data` is unsupported."
- Source: `C:\x.mjs` and `C:/x.mjs` both parse as a URL with protocol `c:`
  ([esm/resolve.js#L949-L951](https://github.com/nodejs/node/blob/v22.22.0/lib/internal/modules/esm/resolve.js#L949-L951)),
  rejected by `throwIfUnsupportedURLScheme` ([esm/load.js#L173-L188](https://github.com/nodejs/node/blob/v22.22.0/lib/internal/modules/esm/load.js#L173-L188)).
  The message ([lib/internal/errors.js#L1853-L1861](https://github.com/nodejs/node/blob/v22.22.0/lib/internal/errors.js#L1853-L1861))
  adds ". On Windows, absolute paths must be valid file:// URLs" when `isWindows` and the protocol
  is one letter. On POSIX `/abs/x.mjs` is a path-absolute URL resolved against the parent `file:`
  URL, so it works; `import('C:/…')` fails on POSIX too (same code, without the Windows hint).
- Probe: `node.esm.import.absolute.native|forward|fileUrl`, `node.esm.import.driveSpecifier`.
- Verdict: **confirmed by source** (error code `ERR_UNSUPPORTED_ESM_URL_SCHEME`); docs imply it.
  Note: CJS `require('C:/x.cjs')` works (probe `node.cjs.__dirname__filename.forwardInput`).

## 6. `spawnSync(process.execPath, ['C:/…/script.mjs'])` works on Windows

- Docs ([child_process.spawnSync](https://nodejs.org/docs/v22.22.0/api/child_process.html#child_processspawnsynccommand-args-options))
  are silent; the argument is just a string. Node opens the main entry through the fs/ESM loader
  (Win32 normalizes `/`, §5) and rewrites `argv[1]` with `path.resolve` (§1).
- Probe: `node.child_process.spawnSync.native|forward` (also passes `cwd` in `/` form and reports the
  child's `argv[1]`, `import.meta.filename`, `cwd`).
- Verdict: **undetermined (needs Windows run)** — expected to work; `argv[1]` native confirmed by source.

---

## Verdicts

| Claim                                         | Verdict                                                                                        |
| --------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `process.cwd()` native                        | undetermined (needs Windows run)                                                               |
| `os.tmpdir()` native                          | confirmed by source — but verbatim `TEMP`/`TMP`, so not guaranteed                             |
| `os.homedir()` native                         | confirmed by docs — but verbatim `USERPROFILE`, so not guaranteed                              |
| `__dirname` / `__filename` native             | confirmed by source                                                                            |
| `import.meta.dirname` / `filename` native     | confirmed by docs                                                                              |
| `process.execPath` native                     | undetermined (needs Windows run)                                                               |
| `process.argv[1]` native                      | confirmed by source                                                                            |
| `fileURLToPath(pathToFileURL(native))` native | confirmed by docs                                                                              |
| `realpath*` native for `/` input              | confirmed by source                                                                            |
| `realpath*` case / 8.3 differences            | undetermined (needs Windows run)                                                               |
| recursive `readdir` names native              | confirmed by source                                                                            |
| `Dirent.parentPath` native                    | contradicted for `/` input (root entries echo the input); confirmed by source for native input |
| fs accepts `C:/…` and mixed                   | confirmed by docs (Microsoft)                                                                  |
| `import('C:/…')` / `import('C:\\…')` fails    | confirmed by source (`ERR_UNSUPPORTED_ESM_URL_SCHEME`)                                         |
| POSIX `import('/abs.mjs')` works              | confirmed by docs                                                                              |
| `spawnSync(execPath, ['C:/…'])` works         | undetermined (needs Windows run)                                                               |
