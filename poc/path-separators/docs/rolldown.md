# Rolldown: path separators in module ids (Windows)

Installed version: `rolldown@1.1.5` (repo root). Its pinned resolver is `oxc_resolver@11.23.0`
([`Cargo.toml` at v1.1.5](https://github.com/rolldown/rolldown/blob/v1.1.5/Cargo.toml), line 292).
Probe: `poc/path-separators/probes/rolldown.mjs`.

## How the repo uses Rolldown ids

- `code/core/scripts/generate-source-files.ts` (`generateExportsFile`) runs `rolldown()` with
  `resolve.alias` values built with **`pathe`** `join` (so `C:/...` on Windows), plus a plugin that
  returns `\0`-prefixed virtual ids. It only reads `chunk.exports` / `chunk.name`, never module ids.
  Relevant claim: 3.
- `scripts/build/utils/generate-types-rolldown.ts` builds `input` with `pathe` `join` (forward
  slashes on Windows; claim 2) and passes an `external` function that matches
  `id.includes(`${sep}node_modules${sep}${dep}${sep}`)` using `sep` from `node:path`, with an
  eslint-disable comment saying it "matches rolldown's native module ids with path.sep".
  Modelled by claim 5 (`rolldown.output.external.resolvedId`). Its `resolveId` plugin splits
  `importer` on `?` and tests a `.d.ts` regex, which works with either separator.

## Claim 1: ids Rolldown resolves itself are native (`\` on Windows)

Covers `resolveId` `importer`, `load`/`transform` `id`, `this.getModuleIds()`, `chunk.moduleIds`
and `chunk.facadeModuleId` (probe ids `rolldown.output.*`).

- Public docs ([rolldown.rs plugin API](https://rolldown.rs/apis/plugin-api)) say nothing about
  separators in ids.
- Rolldown's internal design doc at the installed tag,
  [`internal-docs/module-id/implementation.md` @ v1.1.5](https://github.com/rolldown/rolldown/blob/v1.1.5/internal-docs/module-id/implementation.md),
  says it directly (line 52): "The resolver (`oxc_resolver`) returns a `PathBuf`. Rolldown
  converts it to a string via `full_path().to_str()` and stores it as-is — no separator
  normalization. On Windows, module IDs contain native `\` separators". Its comparison table
  (lines 56–63) gives `C:\Users\project\src\file.js` for both Rollup and Rolldown and says the two
  are "aligned".
- Source: [`crates/rolldown_resolver/src/resolver.rs` @ v1.1.5](https://github.com/rolldown/rolldown/blob/v1.1.5/crates/rolldown_resolver/src/resolver.rs)
  line 178: `path: info.full_path().to_str().expect("Should be valid utf8").into()`.
- The shipped typings hint at the same thing for `codeSplitting` group `test`:
  "it's recommended to use `[\\/]` to match the path separator instead of `/` to avoid potential
  issues on Windows" (`node_modules/rolldown/dist/shared/define-config-BhJ90aEv.d.mts`, line 1064).

Verdict: **confirmed by source** (Rolldown's own internal doc plus resolver code). The public docs
are silent.

## Claim 2: `input` as native `\` or `/` absolute path both work

Probe ids: `rolldown.input.entry.native`, `rolldown.input.entry.forward`.

- Docs: `input` "Relative paths are resolved based on the `cwd` option"
  (`define-config-BhJ90aEv.d.mts`, line 3431). They say nothing about separators.
- Source: entries go through the built-in resolver when no plugin claims them. In
  `oxc_resolver@11.23.0`, an absolute specifier is looked up verbatim
  ([`src/lib.rs` `require_absolute`](https://github.com/oxc-project/oxc-resolver/blob/v11.23.0/src/lib.rs),
  line 548: `self.cache.value(Path::new(specifier...))`). The result is then passed through
  `load_realpath` (line 348), which canonicalizes it when `symlinks` is on. Rolldown defaults to
  `symlinks: true`
  ([`resolver_config.rs` @ v1.1.5](https://github.com/rolldown/rolldown/blob/v1.1.5/crates/rolldown_resolver/src/resolver_config.rs),
  line 132). Canonicalization rebuilds the path one component at a time with `PathBuf::push`, and on
  Windows it rewrites a trailing `/` root as `\`
  ([`src/cache/cached_path.rs` `normalize_root`](https://github.com/oxc-project/oxc-resolver/blob/v11.23.0/src/cache/cached_path.rs),
  lines 208–219, and `push_normalized_component` in
  [`src/path.rs`](https://github.com/oxc-project/oxc-resolver/blob/v11.23.0/src/path.rs), line 126).
  So a `C:/.../entry.js` input should come out as the `C:\...\entry.js` id.
- Prediction: both forms build, and on Windows `facadeModuleId` and module ids are `\`. The probe
  also records the raw `source` given to `resolveId` for the entry, which should be the input
  verbatim.

Verdict: **undetermined (needs Windows run)**. Source reading predicts "works, ids native" for both
forms, but that result depends on the realpath step. The docs are silent.

## Claim 3: `resolve.alias` values in `/` form work on Windows

Probe ids: `rolldown.input.alias.native`, `rolldown.input.alias.forward`. The fixture imports
`sub/b.js` both via the alias and via `./sub/b.js` to check that the two dedupe.

- Docs ([rolldown.rs `resolve`](https://rolldown.rs/reference/InputOptions.resolve), and the
  typings at line 3486) show `alias: { '@': '/src', utils: './src/utils' }`. They say nothing about
  separators or Windows. They note that "`resolve.alias` will not call `resolveId` hooks of other
  plugin".
- Source: aliases are handled inside `oxc_resolver` (rolldown's `alias` maps to `ResolveOptions::alias`,
  see `binding-*.d.mts` line 511). The substituted specifier is resolved like any other absolute
  path and then goes through the same `load_realpath` canonicalization as claim 2, so the
  resulting id should be native and should equal the one from the relative import.

Verdict: **undetermined (needs Windows run)**. Source predicts it works and dedupes. This is the
setup `generate-source-files.ts` uses.

## Claim 4: a `/`-form absolute id returned by a plugin is kept as-is (duplicate risk)

Probe id: `rolldown.input.pluginForwardId`. A plugin resolves `virtual-a` to `toForward(a.js)`, and
the same entry also imports `./a.js` through built-in resolution.

- Source: [`crates/rolldown_plugin/src/utils/resolve_id_with_plugins.rs` @ v1.1.5](https://github.com/rolldown/rolldown/blob/v1.1.5/crates/rolldown_plugin/src/utils/resolve_id_with_plugins.rs)
  line 113: `id: ModuleId::new(r.id)`. The plugin's id is wrapped without normalization.
  `ModuleId` equality is "raw string comparison over `as_str()`"
  ([module-id doc](https://github.com/rolldown/rolldown/blob/v1.1.5/internal-docs/module-id/implementation.md),
  line 50). The doc's risk table (line 82) says: "Scan stage cache | `ModuleId` → `VisitState` |
  None | Same path resolved differently = duplicate module". Line 65 adds: "some plugins may
  internally assume `/` separators when doing string matching on module IDs".
- Related: [rolldown#9595](https://github.com/rolldown/rolldown/pull/9595) (shipped in v1.1.0)
  fixes `preserveModulesRoot` for "slash-normalized absolute ids" next to "native backslash paths".
  That confirms both id forms occur in practice on Windows (for example from Vite plugins).
- Prediction on Windows: two modules for `a.js` (`C:\...\a.js` and `C:/.../a.js`), so `a.js` is
  bundled twice. On Linux: one module.

Verdict: **confirmed by source** that the id is kept verbatim and that ids are compared as strings.
**Undetermined (needs Windows run)** for whether the duplicate shows up in the output.

## Claim 5 (repo-modelled): `external(id, parent, isResolved)` gets native resolved ids, so `path.sep` matching works

Probe id: `rolldown.output.external.resolvedId`. Only the `${sep}node_modules${sep}fakedep${sep}`
clause from `generate-types-rolldown.ts` is used, so the module can only be externalized at the
resolved stage.

- Docs: `ExternalOptionFunction = (id, parentId, isResolved)` with "@param isResolved Whether the
  id has been resolved" (`define-config-BhJ90aEv.d.mts`, lines 3196–3199). The docs say nothing about
  separators.
- Source: [`crates/rolldown_plugin/src/utils/resolve_id_check_external.rs` @ v1.1.5](https://github.com/rolldown/rolldown/blob/v1.1.5/crates/rolldown_plugin/src/utils/resolve_id_check_external.rs)
  line 33 calls `external(specifier, importer, false)` first. Line 60 then calls
  `external(resolved_id.id, importer, true)` with the resolver's id, which is native per claim 1.
  A `/node_modules/dep/` matcher would therefore miss on Windows.

Verdict: **confirmed by source**. Rolldown's own typings recommend `[\\/]` for the same reason.

## Search notes

- Web search for "rolldown windows backslash module id" returned nothing useful. GitHub issue
  search (via `github.com/rolldown/rolldown/issues?q=windows+backslash`) surfaced #9595 (above),
  #7712 (unescaped backslashes in emitted `require()` on Windows, closed), #8732 (tsconfig paths
  with mixed separators on Windows, closed) and #10946 (a draft about watch-path identity that
  replaces a `#[cfg(windows)]` backslash fallback). None of them change claims 1–5.
