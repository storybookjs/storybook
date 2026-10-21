# webpack: path separators (docs and source findings)

Installed versions (repo root): `webpack@5.105.2`, `enhanced-resolve@5.24.3`, `loader-runner@4.3.1`,
`watchpack@2.5.2`, `schema-utils@4.3.3`. Source links point at the `v5.105.2` tag; line numbers are from
`node_modules/webpack/lib/...` at that version.

Probe: `poc/path-separators/probes/webpack.mjs`. It runs real compilations (`mode: 'development'`,
`devtool: false`, `target: 'node'`, `cache: false`) with a recording loader and plugin, then closes the
compiler.

## 1. Output: resources, loader paths and `compiler.context` are native on Windows

**Claim:** `NormalModule.resource`, loader `this.resourcePath`, `this.context`, `this.rootContext`, and
`compiler.context` use `\` on Windows.

- **Docs.** The [loader API](https://webpack.js.org/api/loaders/#thisresourcepath) only shows POSIX examples
  (`'/abc/resource.js'`). It says nothing about Windows or separators. `this.rootContext` is documented
  as "the [`context`](https://webpack.js.org/configuration/entry-context/#context) option of the
  configuration". So it is whatever the user passed, not something webpack computes.
- **Source.**
  - **Resources.** These come from enhanced-resolve. Its `join`/`normalize` run every `X:/` or `X:\` path
    through `path.win32.normalize`, on every OS (`enhanced-resolve/lib/util/path.js` ~L150-185, `case
    PathType.AbsoluteWin: return winNormalize(...)`). A resolved resource for a drive-letter path is
    therefore always backslash.
  - **Module and loader `context`.** `NormalModule` takes `getContext(resource)` from loader-runner
    (`NormalModule.js` L356). loader-runner's `dirname` cuts at the last `/` or `\` (`loader-runner/lib/LoaderRunner.js`
    L78-89), so the result follows the resource's style.
  - **`this.rootContext`.** It is `options.context` (`NormalModule.js` L850), and `compiler.context` is
    stored verbatim (`Compiler.js` L304; `webpack.js` L84). The default is `process.cwd()`
    (`config/defaults.js` L288), which is native.
- **Verdict:**
  - Resource, `this.resourcePath` and `this.context`: **confirmed by source**.
  - `compiler.context` and `rootContext`: native **only when the configured `context` is native**
    (the default `process.cwd()` and `path.resolve` are native). **Confirmed by source; needs a Windows
    run** to show the observed values.

## 2. Input: `/`-form `context`, `entry`, `output.path` and `resolve.alias` on Windows

- **Docs.**
  - [`context`](https://webpack.js.org/configuration/entry-context/#context): "The base directory, an
    **absolute path**".
  - [`output.path`](https://webpack.js.org/configuration/output/#outputpath): "The output directory as an
    **absolute** path".
  - [`resolve.alias`](https://webpack.js.org/configuration/resolve/#resolvealias): the examples use
    `path.resolve`.
  - None of these pages mentions separators. The [watch troubleshooting page](https://webpack.js.org/configuration/watch/#windows-paths)
    says the opposite of the claim's worry. It warns that `\` (string concatenation like
    `__dirname + '/app/folder'`) "can break some functionality" and recommends `path.resolve`/`path.join`.
- **Source.**
  - **Schema.** The schema's `absolutePath` check accepts `^(?:[A-Za-z]:[\\/]|\\\\|\/)`
    (`schemas/WebpackOptions.check.js` L6; same regex in `schema-utils/dist/keywords/absolutePath.js`).
    So `C:/...` passes validation.
  - **Not normalized.** `context` and `output.path` are kept verbatim: see `config/normalization.js`
    L392 and `WebpackOptionsApply.js` L98 (`compiler.outputPath = options.output.path`).
  - **Writes and resolution still work.** Emitting uses `util/fs.js` `join` (L496-507). For a root that
    is not POSIX-absolute it falls back to `path.win32.join`, so writes produce `\`. Resolution against
    a `/` context or alias goes through enhanced-resolve's `winNormalize`, so modules come back native.
  - **Module ids.** `util/identifier.js` (`WINDOWS_ABS_PATH_REGEXP = /^[a-z]:[\\/]/i`, L9/L51) accepts
    both forms when making ids relative.
- **Prediction recorded in the probe (Windows):**
  - Compilation succeeds and writes the output.
  - `compiler.context`, `compiler.outputPath` and `this.rootContext` stay `/`.
  - `resource` and loader `this.context` become `\`.
  - The emit `targetPath` is `\`.
  - Named module ids are identical to the native run.
- **Verdict:** accepted by schema and code paths: **confirmed by source**. That webpack echoes `/` back
  through `compiler.context`/`rootContext` while resources are `\` is the **mixed-style hazard**: a loader
  doing `resourcePath.startsWith(rootContext)` would fail. **Undetermined (needs Windows run)**.

## 3. Matching: string `Rule.include` in `/` form against a native resource

- **Docs.**
  - [Condition](https://webpack.js.org/configuration/module/#condition): "A string: To match the input
    must start with the provided string. I. e. an absolute directory path, or absolute path to the file."
  - [Rule conditions](https://webpack.js.org/configuration/module/#rule-conditions): the resource is "An
    absolute path to the file requested. It's already resolved".
  - The docs never say that string conditions are normalized. `module.noParse` advises "use `[\\/]` in regex
    to match `\` on Windows and `/` on Mac/Linux".
  - Note: the live docs describe `Rule.glob` and `performance.osDependentRules` "since webpack 5.110.0".
    They are **not available** in the installed 5.105.2.
- **Source.** `lib/rules/RuleSetCompiler.js` L294-298 compiles a string condition to
  `str.startsWith(condition)`, and a RegExp to `condition.test(v)` (L314-318). There is no separator or
  case normalization. `NormalModuleFactory.js` L240 wires `include` to the `resource` data, which is
  `resourceData.path` (L691), the enhanced-resolve result and so native.
  `BasicMatcherRulePlugin`/`ObjectMatcherRulePlugin` only forward to `compileCondition`.
- **Prediction (Windows), checked in the probe by which modules each rule's loader ran on:**

  | Include condition | Matches `sub\b.js`? |
  | --- | --- |
  | Native string | yes |
  | `C:/.../sub` | no |
  | `c:/...` (lower-case drive) | no |
  | `/\/sub\//` | no |
  | `/[\\/]sub[\\/]/` | yes |
  | `/\\sub\\/` | yes |

  Because the schema accepts `C:/...` as absolute (see the `forwardPassesSchema` claim), the
  non-match is **silent**: no error and no warning.
- **Verdict:** `/` string include does NOT match on Windows: **confirmed by source** (plain
  `startsWith`, no normalization; docs silent). The Windows run should confirm it.

## 4. Output: `fileDependencies` / `contextDependencies`

- **Docs.** The [loader API](https://webpack.js.org/api/loaders/#thisadddependency) says `addDependency`
  adds a file "in order to make them watchable". It is silent on path format.
- **Source.**
  - loader-runner pushes the string as-is. `NormalModule` copies `buildInfo.fileDependencies` into the
    compilation (`NormalModule.js` L1152, L1703-1712; summary in `Compilation.js` `summarizeDependencies`
    L4331). `LazySet`/`Set` semantics mean string equality, with no normalization.
  - Webpack's own entries come from resolver and module paths, so they are native.
  - watchpack (`getWatcherManager.js` L52, `DirectoryWatcher.js` L57/L493) keys watchers by
    `path.dirname(file)` and `file.toLowerCase()`. Neither normalizes separators. But change events
    are produced from `path.join(this.path, item)` (L598, L831), which on Windows is always `\`.
  - So a `/`-form dependency is a second, distinct entry, and (source reading, not verified here) it
    may never receive a change event on Windows.
- **Prediction (Windows):**
  - The native `a.js`/`entry.js` entry and the `/` form added by the loader or plugin are both stored,
    so the probe's style list is `['backslash','forward']`.
  - Context deps added in `/` form are stored verbatim.
- **Verdict:** native for webpack-added entries: **confirmed by source**. Forward entries are kept
  verbatim and not deduplicated: **confirmed by source**. Whether watch mode treats them as the same
  file: **undetermined (needs Windows run)**. Source suggests it does not.

## Summary

| Claim | Verdict |
| --- | --- |
| 1 resource / resourcePath / this.context native | confirmed by source |
| 1 compiler.context / rootContext native | contradicted as stated: they echo the configured value (native only if configured natively) |
| 2 `/` inputs accepted | confirmed by source; echo-back styles undetermined (needs Windows run) |
| 3 `/` string include does not match | confirmed by source (docs silent) |
| 4 deps native; `/` deps stored verbatim | confirmed by source; watch equivalence undetermined (needs Windows run) |
