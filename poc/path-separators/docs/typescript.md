# TypeScript compiler API: path separators

Installed version: `typescript@6.0.3` (repo root). `code/frameworks/svelte-vite` resolves the same copy.
Sources cited at tag [`v6.0.3`](https://github.com/microsoft/TypeScript/tree/v6.0.3) and in the
installed bundle `node_modules/typescript/lib/typescript.js` (line numbers below are for that file).

## Why this matters for Storybook

`code/frameworks/svelte-vite/src/plugins/generateDocgen.ts` keeps `node:path` with the eslint reason
"matches TypeScript host file names with path.sep". It wraps `ts.createCompilerHost()` and runs these
tests on the file names TypeScript passes to the host:

- `readFile` / `fileExists`: `fileName.endsWith(path.sep + 'package.json')` (package.json cache)
- `getSourceFile`: `fileName.split(path.sep).some(part => part === 'node_modules')` (static cache)
- elsewhere it tests `sourceFile.fileName.includes('node_modules/svelte/elements.d.ts')` with a `/` literal.

The source below says TypeScript hands the host `/`-separated names on every platform. On Windows
`path.sep` is `\`, so the first two tests should never match. That does not crash anything; the two
caches just never get used. The `/` literal test is the correct one. If Windows confirms this, the
eslint reason is wrong: the code should compare against `/` (and could then drop `node:path`).

## Documentation

The official docs don't say anything about separators. The
[Using the Compiler API](https://github.com/microsoft/TypeScript/wiki/Using-the-Compiler-API) wiki
page never mentions `/`, `\`, Windows paths or normalization (its own example builds paths with
Node `path.join`). The public `typescript.d.ts` types every file name as plain `string`. Every
finding below comes from source code.

The rule is stated in [`src/compiler/path.ts` L21-28](https://github.com/microsoft/TypeScript/blob/v6.0.3/src/compiler/path.ts#L21-L28):

> Internally, we represent paths as strings with '/' as the directory separator. When we make
> system calls (eg: LanguageServiceHost.getDirectory()), we expect the host to correctly handle
> paths in our specified format.

`directorySeparator = "/"`. [`normalizeSlashes` L526](https://github.com/microsoft/TypeScript/blob/v6.0.3/src/compiler/path.ts#L526)
replaces every `\` with `/`. It is called by `combinePaths` (L579), `getDirectoryPath` (L312),
`normalizePath` (L722), `resolvePath` (L606) and `toPath` (L762).

## Claim 1: output is `/` everywhere

The claim is right for most APIs but wrong for three of the ones listed.

| API | Source | Prediction on Windows |
| --- | --- | --- |
| `program.getSourceFiles()[].fileName` | Roots go through `processRootFile` → `normalizePath(fileName)` ([program.ts L3291-3292](https://github.com/microsoft/TypeScript/blob/v6.0.3/src/compiler/program.ts#L3291-L3292); bundle L129102). Imports are resolved with `combinePaths`/`getDirectoryPath`. | `/` |
| `program.getRootFileNames()` | `getRootFileNames: () => rootNames` ([program.ts L1877](https://github.com/microsoft/TypeScript/blob/v6.0.3/src/compiler/program.ts#L1877)) returns the caller's array unchanged. | **as given**: `\` if roots were native, so **contradicts the claim** |
| `ts.sys.resolvePath` | `resolvePath: path => _path.resolve(path)` ([sys.ts L1541](https://github.com/microsoft/TypeScript/blob/v6.0.3/src/compiler/sys.ts#L1541); bundle L8332) | **`\` (native)**, so **contradicts the claim**. The separate internal helper `ts.resolvePath` from path.ts does normalize to `/`. It is exported at runtime but missing from `typescript.d.ts`. |
| `ts.sys.realpath` (not in the claim, recorded anyway) | `fs.realpathSync.native` ([sys.ts L1917](https://github.com/microsoft/TypeScript/blob/v6.0.3/src/compiler/sys.ts#L1917)) | `\` (native). Module resolution wraps it in `normalizePath` ([moduleNameResolver.ts L1974-1979](https://github.com/microsoft/TypeScript/blob/v6.0.3/src/compiler/moduleNameResolver.ts#L1974-L1979)). |
| `ts.resolveModuleName(...).resolvedModule.resolvedFileName` | The containing directory comes from `getDirectoryPath` (normalizes), candidates come from `combinePaths`, and the final step runs through `realPath` → `normalizePath`. | `/`, even for a native `containingFile` |
| `ts.parseJsonConfigFileContent(...).fileNames` | `matchFiles` starts with `normalizePath(path)` and builds names with `combinePaths` ([utilities.ts L9826-9828](https://github.com/microsoft/TypeScript/blob/v6.0.3/src/compiler/utilities.ts#L9826-L9828)) | `/`, even for a native `basePath` |
| `ts.findConfigFile` (used by generateDocgen) | `combinePaths(ancestor, configName)` ([program.ts L328-333](https://github.com/microsoft/TypeScript/blob/v6.0.3/src/compiler/program.ts#L328-L333)) | `/` |
| diagnostics' `file.fileName` | This is the `SourceFile.fileName` | `/` |

## Claim 2: input accepts native `\`, and host callbacks receive `/`

- Native roots are accepted: `processRootFile` normalizes them and `program.getSourceFile(name)`
  goes through `toPath` (normalizes), so both `C:\…` and `C:/…` look up the same file.
- Host callbacks get `/` names. `getSourceFile` is called with the normalized root or resolved
  name. `fileExists`/`readFile`/`directoryExists` are called with `combinePaths`/`getDirectoryPath`
  output during module and package.json-scope resolution. Default lib paths come from
  `getDirectoryPath(normalizePath(system.getExecutingFilePath()))` ([program.ts L466](https://github.com/microsoft/TypeScript/blob/v6.0.3/src/compiler/program.ts#L466)).
- The default `ts.createCompilerHost` forwards these names unchanged to `ts.sys`, which calls
  `node:fs`. That works because Win32 `fs` accepts `/`.
- No source line promises this for every call path, so the probe records every name each callback
  receives (`raw.programNativeRoots.calls`) and runs generateDocgen's exact `path.sep` tests on them.

## Claim 3: `ts.sys.getCurrentDirectory()` / `getExecutingFilePath()`

- `getCurrentDirectory = memoize(() => process.cwd())` ([sys.ts L1501](https://github.com/microsoft/TypeScript/blob/v6.0.3/src/compiler/sys.ts#L1501))
- `executingFilePath = … __filename` ([sys.ts L1498](https://github.com/microsoft/TypeScript/blob/v6.0.3/src/compiler/sys.ts#L1498), returned at L1560)

Both are raw Node values, so they are native (`C:\…`) on Windows. `createCompilerHost().getCurrentDirectory()`
also passes it through unchanged ([program.ts L481](https://github.com/microsoft/TypeScript/blob/v6.0.3/src/compiler/program.ts#L481)).
TypeScript normalizes these values where it uses them internally, but not in what `ts.sys` returns.

## Verdicts

| Claim | Verdict |
| --- | --- |
| 1. `getSourceFiles().fileName`, `resolveModuleName` `resolvedFileName`, `parseJsonConfigFileContent().fileNames`, diagnostics `file.fileName` (and `findConfigFile`) are `/` | confirmed by source |
| 1. `getRootFileNames()` is `/` | contradicted: it returns roots as given |
| 1. `ts.sys.resolvePath` is `/` | contradicted: it is `path.resolve`, so native |
| 2. Native `\` roots accepted; host `getSourceFile`/`fileExists`/`readFile` receive `/` | confirmed by source (Windows run should confirm that no call path leaks `\`) |
| 2. generateDocgen's `path.sep` tests match TS host names | contradicted by source on Windows: they never match. Undetermined until a Windows run. |
| 3. `ts.sys.getCurrentDirectory()` / `getExecutingFilePath()` are native `\` on Windows | confirmed by source |
