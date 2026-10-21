# Path-separator probes

These probes check how the tools Storybook depends on treat path separators: which forms they accept as input and which forms they return. Each probe drives the tool for real, using the versions installed in this repository, and records one entry per claim. An entry holds the value predicted for the current platform and the value actually observed.

The predictions come from documentation and source code. The notes in `docs/` cite them, one file per probe. Most claims only differ on Windows, so a Linux run checks that the probes work, and a Windows run settles the claims.

## Run on Windows

1. Use the Node version in `.nvmrc`, and make sure Git for Windows and PowerShell are on `PATH`.
2. From the repository root, run `yarn` on the Windows machine itself. Some tools (Rolldown, oxc-resolver, esbuild) install native binaries per platform, so a `node_modules` copied from another OS will not work.
3. Run all probes:

   ```sh
   node poc/path-separators/run.mjs
   ```

   To run only some of them, name them: `node poc/path-separators/run.mjs vite webpack`.

4. Send back `poc/path-separators/report-win32.json`. The console summary lists every claim that did not behave as predicted, but the JSON also holds the raw observed paths.

Each probe runs in its own process with a 180 s timeout, and the whole run takes a few minutes. Fixtures are written to `poc/path-separators/.tmp/`, which is git-ignored and recreated on every run.

Running from a path with spaces or non-ASCII characters is fine. Running on a drive where 8.3 short names are disabled makes the `node-builtins` short-name claim report `no-short-name-available`.

## Probes

| Probe           | What it checks                                                                                              |
| --------------- | ----------------------------------------------------------------------------------------------------------- |
| `node-path`     | `node:path` on the current platform, plus `path.win32` / `path.posix`                                       |
| `pathe`         | pathe 1.1.2 (`code/core`) and 2.0.3 (repo root): output form, edge cases, `delimiter`, `relative`           |
| `node-builtins` | `process.cwd`, `os.tmpdir`, `__dirname`, `import.meta.*`, `fileURLToPath`, `realpath`, `readdir`, fs input |
| `resolvers`     | oxc-resolver, empathic, `require.resolve`, `import.meta.resolve`, tsconfig-paths                            |
| `globs`         | glob (`posix`, `windowsPathsNoEscape`), tinyglobby, fdir, `fs.globSync`                                     |
| `typescript`    | file names in programs, hosts, module resolution and `ts.sys`                                               |
| `vite`          | ids in build and dev plugin hooks, `config.root`, accepted input forms, `normalizePath`                     |
| `vitest`        | test-file paths in state and reporters, `import.meta` inside tests, `root` / `setupFiles` / `include`       |
| `rollup`        | ids from default resolution, entry input forms, plugin-returned ids and duplicate modules                   |
| `rolldown`      | the same for Rolldown, plus the second `external()` call used by `generate-types-rolldown.ts`               |
| `esbuild`       | `onResolve` / `onLoad` paths, `outputFiles`, metafile keys, accepted input forms                            |
| `webpack`       | `resource`, loader context, `rootContext`, `include` string matching, dependency sets                       |
| `watchers`      | watchpack and chokidar event paths and `startsWith` matching for `/` input                                  |
| `shell-git-env` | cmd builtins and spawned binaries with `/` paths, git pathspecs, `PATH` delimiter, env round-trip           |
