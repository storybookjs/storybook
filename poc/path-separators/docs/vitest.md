# Vitest: path separators

Installed version (repo root, also what `code/`, `code/core` and `code/addons/vitest` resolve):
**vitest 5.0.3**, running on **vite 7.3.6**. Source links are pinned to tag `v5.0.3` (Vitest) and
`v7.3.6` (Vite). Probe: `poc/path-separators/probes/vitest.mjs`.

## Claim 1: Vitest uses pathe internally

- **Package manifest.** `pathe` is **not** a runtime dependency. It is in `devDependencies` because
  it is bundled into `dist/`:
  [packages/vitest/package.json@v5.0.3](https://github.com/vitest-dev/vitest/blob/v5.0.3/packages/vitest/package.json)
  (`"pathe": "catalog:"` under `devDependencies`). The installed
  `node_modules/vitest/package.json` agrees: its `dependencies` are `@types/chai, @vitest/mocker,
  chai, es-module-lexer, expect-type, magic-string, obug, picomatch, std-env, tinybench, tinyexec,
  tinyglobby, why-is-node-running`.
- **Bundling.** [packages/vitest/rollup.config.js@v5.0.3](https://github.com/vitest-dev/vitest/blob/v5.0.3/packages/vitest/rollup.config.js)
  marks only `dependencies` and `peerDependencies` as external (`const external = [...builtinModules,
  ...Object.keys(pkg.dependencies), ...Object.keys(pkg.peerDependencies), ...]`), so pathe is
  inlined. `node_modules/vitest/LICENSE.md` lists it under "Licenses of bundled dependencies"
  (`## pathe`, `Repository: unjs/pathe`).
- **Source use.** The Node side imports pathe directly, for example
  [src/node/config/resolveConfig.ts L19](https://github.com/vitest-dev/vitest/blob/v5.0.3/packages/vitest/src/node/config/resolveConfig.ts#L19)
  (`import { join, normalize, relative, resolve } from 'pathe'`) and
  [src/node/project.ts L16](https://github.com/vitest-dev/vitest/blob/v5.0.3/packages/vitest/src/node/project.ts#L16).
  In the installed build that code is in
  `node_modules/vitest/dist/chunks/pathe.M-eThtNZ.CknpM8Or.js` L300-306 (pathe's
  `normalizeWindowsPath`: `input.replace(/\\/g, "/")` and an upper-case drive letter), imported by
  `dist/chunks/index.DpLw24bj.js` L4 and about 30 other chunks.
- **Caveat.** Not every path goes through pathe. Test-file globbing uses `node:path` and then
  `slash()` from `@vitest/utils/helpers`
  ([src/node/projects/globProjectFiles.ts L23](https://github.com/vitest-dev/vitest/blob/v5.0.3/packages/vitest/src/node/projects/globProjectFiles.ts#L23):
  `files.map((file) => slash(path.resolve(cwd, file)))`). `import.meta` comes from Vite's module
  runner, which does not use pathe (see claim 3).

**Verdict: confirmed by source.** The claim holds with one correction: pathe is bundled into
Vitest. It is not a runtime dependency, so `pathe` from Vitest's dependency tree cannot be relied
on.

## Claim 2: test-file paths Vitest exposes use `/`

- **Docs.** Only the reporter API documents a separator. `TestModule.moduleId`: "This is usually
  an absolute unix file path (even on Windows). It can be a virtual id if the file is not on the
  disk." ([vitest.dev/api/advanced/test-module](https://vitest.dev/api/advanced/test-module)).
  `expect.getState().testPath` and the config docs say nothing about separators.
- **`onFinished` is gone.** Vitest 5 has no `onFinished` reporter hook. The probe uses
  `onTestRunEnd(testModules)` and `vitest.state.getFiles()` instead.
- **Source.**
  - Test files are found by globbing, then passed through `slash(path.resolve(cwd, file))`
    (globProjectFiles.ts L23; installed `dist/chunks/index.DpLw24bj.js` L11945-11952). These
    strings become the spec `moduleId`, which is also the worker `filepath`.
  - `expect.getState().testPath` is a getter that returns `getWorkerState().filepath`
    ([src/integrations/chai/index.ts L49-51](https://github.com/vitest-dev/vitest/blob/v5.0.3/packages/vitest/src/integrations/chai/index.ts#L49-L51);
    installed `dist/chunks/index.C4tKZ0yW.js` L8040-8042).
  - `config.root` is Vite's root, which Vite stores after `normalizePath`. `setupFiles` go through
    pathe `normalize` (resolveConfig.ts L40-52 and L594-596).
  - A plugin's `transform` hook receives Vite module ids. Vite normalizes these to `/` on Windows.
- **Linux probe.** Every surface returned `forward`: `testPath`, the in-test `task.file.filepath`,
  the reporter `TestModule.moduleId` and `TestModule.task.filepath`,
  `vitest.state.getFiles()[].filepath`, the resolved `config.root` and `config.setupFiles`, and
  the `transform` ids for the test file and the setup file. On Linux this is trivially true. The
  Windows prediction is `forward` everywhere.

**Verdict: confirmed by source** (`moduleId` is backed by the docs wording). Windows run still
needed to confirm, mainly for `transform` ids and `testPath`.

## Claim 3: `import.meta.*`, `__dirname`, `__filename` inside a test

- **Docs.** Vitest's docs say nothing about the separator format of `import.meta.filename` or
  `import.meta.dirname`.
- **Source.**
  - Vitest's runner builds `import.meta` with Vite's
    `createDefaultImportMeta` and adds `main` and `resolve` (installed
    `dist/chunks/index.k8L_ZRzq.js` L475-486, used by `dist/chunks/base.DhkQeZwd.js` L204).
  - Vite's implementation
    ([packages/vite/src/module-runner/createImportMeta.ts@v7.3.6 L21-25](https://github.com/vitejs/vite/blob/v7.3.6/packages/vite/src/module-runner/createImportMeta.ts#L21-L25);
    installed `node_modules/vite/dist/node/module-runner.js` L967-972) sets
    `filename: isWindows ? toWindowsPath(filename) : filename` and the same for `dirname`, with
    `url: posixPathToFileHref(modulePath)`.
  - So `filename` and `dirname` are native (`\` on Windows), matching Node's own definition. `url`
    is a `file:///` URL that uses `/`.
  - Vitest's evaluator also injects `__filename` and `__dirname` as function arguments into every
    inlined module, ESM included. It copies them from `import.meta`
    ([src/runtime/moduleRunner/moduleEvaluator.ts L287-288, L371-375](https://github.com/vitest-dev/vitest/blob/v5.0.3/packages/vitest/src/runtime/moduleRunner/moduleEvaluator.ts#L287-L288);
    installed `dist/module-evaluator.js` L182-183, L232-233). They are therefore defined even in a
    `.mjs` test, and they are native too.
- **Linux probe.** Test file and setup file: `import.meta.url` is `file:///…/sep.probe.test.mjs`.
  `filename`, `dirname`, `__filename` and `__dirname` are all present and `/`-separated (POSIX
  native).

**Verdict: confirmed by source.** `filename`, `dirname`, `__filename` and `__dirname` are native;
`url` is a `/` file URL. Windows run needed to confirm the backslash output.

## Claim 4: `setupFiles`, `include`, `root` accept both `\` and `/` absolute paths on Windows

- **Docs.**
  - [`include`](https://vitest.dev/config/include): "A list of glob patterns … These patterns are
    resolved relative to the root" and "Vitest uses the tinyglobby package to resolve the globs."
    The page says nothing about absolute patterns or backslashes.
  - [`setupFiles`](https://vitest.dev/config/setupfiles): "Paths to setup files resolved relative
    to the root." The page says nothing about separators.
  - `root`: Vite's root, which goes through `path.resolve` and `normalizePath`. The docs say
    nothing about separators.
- **Source.**
  - `setupFiles` go through `resolvePath` (`resolveModule` from local-pkg/mlly, otherwise pathe
    `resolve`), then pathe `normalize`. That turns `\` into `/`, so both forms should work.
  - `include` patterns are handed to tinyglobby unchanged (globProjectFiles.ts). In tinyglobby
    0.2.17 (`node_modules/tinyglobby/dist/index.mjs` L135-143), an absolute pattern is
    re-relativized with `posix.relative(escapedCwd, pattern)`, and `\` is treated as an escape
    character. An absolute **backslash** pattern is therefore predicted to match nothing on
    Windows.
  - A relative `include` with a backslash `root` should be fine, because `cwd` is the normalized
    root.
- **Linux probe.** The forward variants of `root`, `setupFiles` and absolute `include` all ran:
  the setup file ran, the test ran, and the exit code was 0. The backslash variants are recorded
  as `skipped-on-posix`. The baseline run on Windows also uses native (`\`) `root` and
  `setupFiles`, which is extra evidence for those two inputs.

**Verdict.**

- `root` and `setupFiles`: confirmed by source, Windows run still needed.
- `include` with an absolute backslash glob: **undetermined (needs Windows run)**. The prediction
  **contradicts** the claim: tinyglobby likely finds no files.
