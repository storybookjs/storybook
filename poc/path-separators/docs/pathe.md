# pathe: documentation findings

Versions in the repo:

- **pathe1** = 1.1.2, resolved from `code/core` (`code/core/node_modules/pathe`).
- **pathe2** = 2.0.3, resolved from the repo root (`node_modules/pathe`).

Sources consulted:

- README at the tags: [v1.1.2 README](https://github.com/unjs/pathe/blob/v1.1.2/README.md), [v2.0.3 README](https://github.com/unjs/pathe/blob/v2.0.3/README.md). The installed `README.md` files match these.
- Source at the tags: [v1.1.2 `src/path.ts`](https://github.com/unjs/pathe/blob/v1.1.2/src/path.ts), [v2.0.3 `src/_path.ts`](https://github.com/unjs/pathe/blob/v2.0.3/src/_path.ts), [v2.0.3 `src/index.ts`](https://github.com/unjs/pathe/blob/v2.0.3/src/index.ts), `src/_internal.ts` at both tags.
- Installed dist files. Line numbers below refer to these:
  - v1: `code/core/node_modules/pathe/dist/shared/pathe.ff20891b.mjs` (`V1:<line>`)
  - v2: `node_modules/pathe/dist/shared/pathe.M-eThtNZ.mjs` (`V2:<line>`) and `node_modules/pathe/dist/index.mjs` (`V2idx:<line>`)

What the README says about separators, in both versions: pathe "ensures paths are normalized with slash `/`" and is a "drop-in replacement of the Node.js's path module". The v1.1.2 README adds that "behavior is ALWAYS like POSIX regardless of your input paths format and running platform". The v2.0.3 README says "consistently like POSIX ... (the only exception is `delimiter` constant export, it will be set to `;` on windows platform)". The README does not cover any of the edge cases below, so every per-function verdict depends on the source.

Every function routes its input through `normalizeWindowsPath` (`src/_internal.ts`, identical at both tags; V1:1-7, V2:12-18):

```js
input.replace(/\\/g, "/").replace(/^[A-Za-z]:\//, (r) => r.toUpperCase());
```

This step runs on every platform. Nothing in it checks `process.platform`.

---

## 1. Outputs always use `/`; the drive letter is uppercased

- **Docs:** both READMEs say paths are "normalized with slash `/`" on all platforms.
- **Source:** `resolve`, `normalize`, `dirname`, `basename`, `extname` and `toNamespacedPath` pass input through `normalizeWindowsPath`, and every function only ever adds `/` (V1:15-86, 173-189; V2:27-100, 187-214). `join` concatenates with `/` and then calls `normalize` (V1:44-62; V2:56-76). `relative` is built from `resolve` (V1:157-172; V2:171-186). `cwd()` replaces `\` with `/` (V1:63-68; V2:77-82). The drive letter is uppercased only when the path starts with `X:/` (after backslashes are converted). A bare `c:` is not uppercased.
- **Caveat:** in v2, `parse().root` is computed from the raw input with `_PATH_ROOT_RE` and is not uppercased. `parse('c:\\a\\b.js').root` is `'c:/'` while `dir` is `'C:/a'` (V2:25, 216). In v1, `root` is `'C:'`, with no trailing slash.
- **Verdict:** **confirmed by source** for both versions. The Windows run must confirm it for real native paths (`pathe{1,2}.output.*.native`).

## 2. `\` inputs are accepted and converted to `/` on every platform, including POSIX

- **Docs:** the README promises consistent POSIX-like behavior "regardless of your input paths format and running platform". It does not say that a literal `\` in a POSIX file name gets rewritten.
- **Source:** `normalizeWindowsPath` replaces every `\` without checking the platform (`_internal.ts` line 9 at both tags). This gives `join('/a', 'b\\*.js')` → `/a/b/*.js`. Node posix returns `/a/b\*.js`. On POSIX a real file named `b\c.txt` cannot be addressed through pathe. The probe shows `existsSync(pathe.join(dir, 'b\\c.txt'))` is `false` while node's join finds the file.
- **Verdict:** **confirmed by source** for both versions. The Linux probe confirms it too.

## 3. `sep` is always `/`; `delimiter`

- **Source v1:** `sep = "/"` and `delimiter = ":"` are hard-coded (V1:13-14; [v1.1.2 `src/path.ts` L19-20](https://github.com/unjs/pathe/blob/v1.1.2/src/path.ts#L19-L20)). On Windows, `delimiter` is therefore wrong for `PATH`.
- **Source v2:** `sep = "/"` (V2:26). The named export `delimiter` is `process.platform === "win32" ? ";" : ":"` (V2idx:4; [v2.0.3 `src/index.ts` L12-13](https://github.com/unjs/pathe/blob/v2.0.3/src/index.ts#L12-L13)). The README states this exception.
- **Surprise (v2):** the **default export** is the `posix` proxy (`export { posix as default }`, V2idx:19). It always reports `delimiter: ":"`. So `import path from 'pathe'; path.delimiter` gives `:` even on Windows, while `import { delimiter } from 'pathe'` gives `;`.
- **Verdict:** `sep`: **confirmed by source** (both). v1 `delimiter` is always `:`: **confirmed by source**. v2 named `delimiter` is `;` on Windows: **confirmed by docs**, and the Windows run should confirm it. v2 default-export `delimiter` is always `:`: **confirmed by source**, and the docs say nothing about it.

## 4. `basename('a/b/')`

- **Source v1:** `normalizeWindowsPath(p).split("/").pop()` (V1:187). A trailing slash leaves an empty last segment, so the result is `''`.
- **Source v2:** walks back to the last non-empty segment (V2:203-214), so the result is `'b'`, the same as node.
- **Verdict:** v1 returns `''`: **confirmed by source**. v2 returns `'b'`, so the claim is **contradicted** for v2 (fixed).

## 5. `parse()`

- **Source v1:** `root = normalizeWindowsPath(p).split("/").shift() || "/"` (V1:191). The first segment of a relative path becomes the root, so `parse('a.js')` gives `{root:'a.js', dir:'.', base:'a.js', ext:'.js', name:'a'}`. `base` comes from the broken `basename`, so `parse('a/b/')` gives `{root:'a', dir:'a', base:'', ext:'', name:''}`.
- **Source v2:** `root` comes from `_PATH_ROOT_RE` (`/^[/\\]|^[a-zA-Z]:[/\\]/`, V2:25, 216) and is `''` for relative paths. `parse('a/b/')` gives `{root:'', dir:'a', base:'b', ext:'', name:'b'}`.
- **Both versions:** `parse('/a/b.js')` gives `{root:'/', dir:'/a', base:'b.js', ext:'.js', name:'b'}`.
- **Node difference that remains in v2:** `dir` for a bare file name is `'.'` in pathe and `''` in node. pathe's `dirname()` falls back to `"."` (V2:192).
- **Verdict:** v1 is wrong: **confirmed by source**. v2 `root` and `base`: the claim is **contradicted** for v2 (fixed, except for `dir: '.'` versus node's `''`). `/a/b.js` is correct in both: **confirmed by source**.

## 6. `extname('foo.')`

- **Source v1:** `_EXTNAME_RE = /.(\.[^./]+)$/` (V1:152) requires at least one character after the dot, so the result is `''`.
- **Source v2:** `_EXTNAME_RE = /.(\.[^./]+|\.)$/` (V2:24; [v2.0.3 `src/_path.ts` L19](https://github.com/unjs/pathe/blob/v2.0.3/src/_path.ts#L19)), so the result is `'.'`, the same as node.
- **Verdict:** v1 returns `''`: **confirmed by source**. For v2 the claim is **contradicted**: it returns `'.'`.

## 7. A leading `//` is preserved

- **Source:** `normalize` checks `_UNC_REGEX = /^[/\\]{2}/` and adds `//` back in front (V1:36-41; V2:48-53), in both versions. v1 `join` first collapses `/\/\/+/g` to `/` (V1:61), so `join('//a','b')` gives `'/a/b'`. v2 `join` does not collapse (V2:56-76), so the result is `'//a/b'`. In both versions, `resolve('//a/b')` gives `'/a/b'`: `normalizeString` drops the empty segment, and `resolve` adds back a single `/`.
- **Node comparison:** node posix `normalize('//a/b')` gives `'/a/b'`. Node win32 also preserves the UNC prefix (`'\\\\a\\b\\'`). "Unlike node" therefore holds only against posix node.
- **Verdict:** `normalize` preserves `//` in both versions, and `join` preserves it in v2 only: **confirmed by source**. Both versions drop it in `resolve`, which the claim does not mention.

## 8. `relative()` is case-sensitive

- **Source:** `relative` splits both resolved paths on `/` and compares segments with `!==` (V1:164-170; V2:178-184). Only the drive letter is case-normalized, through `normalizeWindowsPath`. So `relative('C:/Foo/Bar','C:/foo/bar/baz')` gives `'../../foo/bar/baz'`, while node win32 returns `'baz'`. `relative('c:/a','C:/a/b')` gives `'b'`.
- **Docs:** silent.
- **Verdict:** **confirmed by source** for both versions. The result does not depend on the platform.

## 9. `relative()` across drives

- **Source:** both versions special-case two different drive letters: `if (_to[0][1] === ":" && _from[0][1] === ":" && _from[0] !== _to[0]) return _to.join("/")` (V1:160-162; V2:174-176). So `relative('C:/a','D:/b')` gives **`'D:/b'`**, the absolute target. The claim's example is wrong.
- **Where the broken form appears:** when `from` has no drive letter. pathe's `resolve('/a')` stays `'/a'`; unlike node win32, it does not add the current drive (claim 11). So `relative('/a','D:/b')` gives `'../../D:/b'` on every platform. On POSIX, `relative('a','D:/b')` also comes out broken, because the cwd has no drive. Node posix gives `'../../D:/b'` for `relative('C:/a','D:/b')`, which may be where the claim came from.
- **Verdict:** as stated (`C:/a` → `D:/b`), the claim is **contradicted** for both versions. A related bug exists for a drive-less rooted `from`: **confirmed by source**.

## 10. `win32` / `posix` named exports

- **Source v1:** none. The `path` object (V1:203-219) and the index exports have no `win32` or `posix`.
- **Source v2:** `posix` and `win32` are exported (V2idx:16-19), but they are `Proxy` objects over the same `_path`. They change only `delimiter` (`:` or `;`). `win32.sep` is `'/'` and `win32.join('a','b')` is `'a/b'`. These are not node's win32 semantics. The README does not mention them.
- **Verdict:** v1 has none: **confirmed by source**. v2 has both: **confirmed by source**, with the caveat that `win32` is not node's `win32`.

## 11. `resolve()` with a relative input uses `process.cwd()` normalized to `/`

- **Source:** `cwd()` returns `process.cwd().replace(/\\/g, "/")` (V1:63-68; V2:77-82). `resolve` uses it when no argument is absolute. The cwd does not go through `normalizeWindowsPath`, so a lowercase drive letter in `process.cwd()` stays lowercase. A rooted input without a drive (`'/x'`) counts as absolute and comes back as `'/x'`; node win32 returns `'C:\\x'`.
- **Verdict:** **confirmed by source**. The Windows run must confirm the actual drive letter and separators (`pathe{1,2}.resolve.relativeUsesCwd`).

---

## Verdict summary

| Claim                             | pathe1 (1.1.2)                                                            | pathe2 (2.0.3)                                                                                         |
| --------------------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| 1 outputs `/`, drive uppercased   | confirmed by source                                                       | confirmed by source (but `parse().root` is not uppercased)                                             |
| 2 `\` converted on every platform | confirmed by source                                                       | confirmed by source                                                                                    |
| 3 `sep` `/`; `delimiter`          | confirmed by source (`:` always)                                          | named export: confirmed by docs (`;` on win32, needs Windows run); default export: always `:` (source) |
| 4 `basename('a/b/')` → `''`       | confirmed by source                                                       | contradicted (`'b'`)                                                                                   |
| 5 `parse`                         | confirmed by source                                                       | contradicted (fixed); `/a/b.js` correct in both                                                        |
| 6 `extname('foo.')` → `''`        | confirmed by source                                                       | contradicted (`'.'`)                                                                                   |
| 7 leading `//` kept               | normalize: confirmed by source; join collapses it                         | confirmed by source (normalize and join)                                                               |
| 8 `relative` case-sensitive       | confirmed by source                                                       | confirmed by source                                                                                    |
| 9 cross-drive gives `../../D:/b`  | contradicted (`'D:/b'`); broken only for drive-less `from`                | same as v1                                                                                             |
| 10 no `win32`/`posix`             | confirmed by source                                                       | contradicted: exported, but delimiter-only proxies                                                     |
| 11 `resolve` uses cwd with `/`    | confirmed by source; undetermined on real Windows cwd (needs Windows run) | same as v1                                                                                             |
