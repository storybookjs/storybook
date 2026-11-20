# Path Handling

This document is canonical for building, comparing, and passing file paths in `code/` and `scripts/`.
`AGENTS.md` owns the pointer to this file.

## The rule

Write new path code with `pathe`, not `node:path`.

`pathe` returns `/`-separated paths on every platform, including Windows, where `node:path` returns `C:\…`.
Most bugs here are Windows-only and pass Linux CI: a path built with `/` compared to one built with `\` never matches, so a cache never hits, a watcher never fires, or a module is loaded twice.
Using one form everywhere removes that class of bug.

## Existing code is not a reference

Most path code in this repo predates this rule and imports `node:path`.
Do not take it as the convention, and do not copy its imports, its `.replace(/\\/g, '/')` calls, or its `split(path.sep)` into new code, even in the same file.
This document wins over what the surrounding code does.

New code added to a file that imports `node:path` still uses `pathe`.
Normalize where it meets the file's existing values, or migrate the file as described next.

Do not swap an existing file's `node:path` import for `pathe` as a drive-by.
That changes the file's outputs on Windows, and callers elsewhere may compare them with native paths.
Migrate a file only as a deliberate change: check where its returned and exported paths go, move code that shares values together, and update tests that assert native paths.

## Normalize at the boundary

`pathe` accepts native input, so `pathe.resolve(nativePath)` is always safe.
The risk is a `/` value meeting a native value in `===`, `startsWith`, `includes`, a `Map` or `Set` key, or `split(sep)`.
Before such a comparison, pass both sides through `pathe` (`normalize` or `resolve`):

```ts
import { normalize } from 'pathe';

// `file` comes from webpack (native), `projectRoot` from a pathe-built config (`/`).
const isInProject = normalize(file).startsWith(`${normalize(projectRoot)}/`);
```

These return `/`, so `pathe` output matches them directly:

- Vite and Vitest module ids, `importer`, the module graph, `config.root`, and Vitest test-file paths
- TypeScript source-file names, diagnostics, `resolveModuleName` results, and the file names passed to `CompilerHost` callbacks
- tinyglobby and globby results, and esbuild metafile keys
- git output

These return native paths on Windows, so normalize them before comparing:

- `process.cwd()`, `__dirname`, `__filename`, `import.meta.dirname`, `import.meta.filename`, `os.tmpdir()`, `fileURLToPath()`, `require.resolve()`, `fs.realpath*`, recursive `readdir` results
- oxc-resolver, empathic `find.*`, tsconfig-paths (which can return mixed `\` and `/`)
- glob without `posix: true`, fdir without `withPathSeparator('/')`
- Rollup and Rolldown module ids, esbuild `onResolve` / `onLoad` paths and `outputFiles[].path`
- webpack `resource`, `resourcePath`, and loader `context`
- watchpack and chokidar event paths
- TypeScript `getRootFileNames()`, `ts.sys.resolvePath`, `ts.sys.realpath`

Values a tool echoes back keep the form you gave it: webpack `compiler.context` and `rootContext`, empathic `walk.up`, `os.homedir()` from its environment variable.

## Keep `node:path` only for these

Each exception exists because a consumer needs native paths or node-only behavior.
When you keep `node:path`, say which one applies in a comment on the import.

- **`delimiter` and `PATH`.** `pathe` 1.1.2's `delimiter`, and 2.0.3's default-export `delimiter`, are always `:`, which splits `C:\…` entries apart.
- **Paths handed to webpack for its own bookkeeping.** `this.addDependency`, `this.addContextDependency`, `compilation.fileDependencies` and `contextDependencies`, and `module.rules[].include` strings need native paths. webpack does not treat `C:/…` as absolute: a loader dependency in that form is silently re-joined onto the module's directory, and an `include` string never matches. watchpack file watches given `C:/…` never fire.
- **Ids returned from plain Rollup or Rolldown plugins**, which must match the native ids those bundlers create. In Vite plugins, return `/` ids (`pathe` or Vite's `normalizePath`), because Vite build passes plugin-returned ids through unchanged and a second form of the same file becomes a second module.
- **Paths interpolated into cmd built-ins.** `type` and `copy` reject `/` paths even when quoted, and `dir` and `if exist` accept them only when quoted. Node, git, and other executables spawned with `/` paths and `cwd` work.
- **Logic that relies on `node:path`'s Windows `relative`**, which is case-insensitive. `pathe`'s is case-sensitive.
- **Files copied into user projects** (templates, generated config), which cannot depend on `pathe`.

## `pathe` details

- Packages that list `pathe@^1.1.2` (`code/core`, `builder-vite`, `addon-vitest`, `web-components`, `scripts`) get 1.1.2; other packages resolve 2.0.3. If the package you edit does not list `pathe`, add `"pathe": "^2.0.3"` to its `devDependencies`; it is bundled at build time.
- 1.1.2 `basename('a/b/')` returns `''`, and `parse()` returns wrong `root` and `dir` for relative paths. Strip trailing slashes before `basename`, and avoid `parse().root` / `.dir` on relative paths.
- `pathe` converts every `\` to `/`, also on Linux, so do not pass strings that use `\` as an escape (regex sources, escaped glob patterns).
- Build glob and tinyglobby patterns with `pathe` or `/` literals. Both treat `\` in a pattern as an escape, so patterns built with `node:path` match nothing on Windows.
- Absolute ESM `import()` needs a file URL in either form: `import(pathToFileURL(path).href)`.
