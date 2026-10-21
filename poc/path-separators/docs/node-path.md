# node:path: documentation findings

Subject: Node's built-in `node:path`. The Linux run used Node v22.22.0.
Sources:

- Docs: https://nodejs.org/docs/latest-v22.x/api/path.html (cited as **[docs]**)
- Source: https://github.com/nodejs/node/blob/v22.22.0/lib/path.js (cited as **[src]** with line numbers)

General statement in the docs, which applies to claims 1 and 2:

> "On Windows, both the forward slash (`/`) and backward slash (`\`) are accepted as path segment separators; however, the `path` methods only add backward slashes (`\`)." [docs, "Windows vs. POSIX"]

In the source, `isPathSeparator(code)` returns true for both `/` and `\` (lines 66-67). `win32` uses it everywhere. `posix` uses `isPosixPathSeparator`, which accepts only `/`.

## 1. join/resolve/dirname/relative/normalize output `\` on Windows and `/` on POSIX

- `join`: "joins all given path segments together using the platform-specific separator as a delimiter, then normalizes the resulting path." [docs, path.join]
- `resolve`: "The resulting path is normalized" [docs, path.resolve]. `win32.resolve` builds its result with `normalizeString(..., '\\', isPathSeparator)` [src L353].
- `normalize`: separators "are replaced by a single instance of the platform-specific path segment separator (`/` on POSIX and `\` on Windows)" [docs, path.normalize].
- `relative`: `win32.relative` calls `win32.resolve` on both arguments (L633-634), so its output is built from `\`-normalized strings.
- **`dirname`: the docs say nothing about normalizing.** The source shows that `win32.dirname` returns `StringPrototypeSlice(path, 0, end)` (L906), which is a slice of the input. As a result, `win32.dirname('C:/a/b/c')` returns `'C:/a/b'`, not `'C:\\a\\b'`. The same applies to `basename`, `extname` and `parse`, which slice their input too. `format` concatenates `dir + sep + base`, so a `/` dir produces mixed output (`'C:/a\\b.js'`).

Verdict: **partly contradicted (by source)**. join/resolve/relative/normalize: confirmed by docs and source. dirname: it keeps the separators it was given, and it outputs `\` only when the input used `\`. The probe checks this in `dirname.forwardInput`.

## 2. `/`-separated input is accepted on Windows and normalized to `\`

The docs sentence quoted above covers this. One docs example: `path.win32.normalize('C:////temp\\\\/\\/\\/foo/bar')` returns `'C:\\temp\\foo\\bar'` [docs, path.normalize]. Normalization to `\` happens only in the functions that normalize (join/resolve/normalize/relative). The others (dirname/basename/parse) accept `/` but pass it through, as described under claim 1.

Verdict: **confirmed by docs** (for `resolve('C:/a/b')` and `join('C:/a','b/c')`). The run on real Windows will confirm the platform-`path` variants.

## 3. `sep` is `\` / `/` and `delimiter` is `;` / `:`

> path.sep: "`\` on Windows, `/` on POSIX". path.delimiter: "`;` for Windows, `:` for POSIX" [docs]

These values are set at src L1233-1234 (win32) and L1715-1716 (posix).

Verdict: **confirmed by docs**.

## 4. `relative()` is case-insensitive on Windows

**The docs say nothing about this.** They mention only that `basename` is case-sensitive ("Although Windows usually treats file names ... in a case-insensitive manner, this function does not."). In the source, `win32.relative` lowercases both resolved paths before comparing them (`from = StringPrototypeToLowerCase(fromOrig)`, L640-641). If the two lowercased strings are equal, it returns `''` (L643-644). Otherwise it slices the remainder from `toOrig` (L733, L772, L776), so the output keeps the casing of the target. Changing only the drive-letter case is covered by the same lowercase step. `posix.relative` does not lowercase (L1371ff).

Verdict: **confirmed by source** (docs are silent). `relative('C:\\Foo\\Bar','c:\\foo\\bar\\baz')` returns `'baz'`, and `relative('C:\\a\\b','c:\\a\\b\\c')` returns `'c'`.

## 5. `relative()` across drives returns the absolute target

**The docs say nothing about this.** In the source, when no common separator is found before the first mismatch, the code comment says "We found a mismatch before the first common path separator was seen, so return the original `to`" and the function does `return toOrig;` (L723-726). `toOrig` is `win32.resolve(to)`, so forward-slash input is returned with `\`. The same rule applies from a drive path to a UNC path.

Verdict: **confirmed by source** (docs are silent).

## 6. `basename('a/b/')` returns `'b'` on all platforms

> "Trailing directory separators are ignored." [docs, path.basename]

The trailing separator is `/` on both platforms, so the result is `'b'` everywhere. A related point: `posix.basename('a\\b\\')` returns `'a\\b\\'` because `\` is not a separator on POSIX. On Windows the same call returns `'b'`.

Verdict: **confirmed by docs**.

## 7. `parse('a.js')` returns `{ root:'', dir:'', base:'a.js', ext:'.js', name:'a' }`

The docs show only rooted examples. In the source, `parse` starts from `{ root: '', dir: '', base: '', ext: '', name: '' }` (L1080 win32, L1633 posix) and fills `base`/`ext`/`name` from the input. No root or dir is found, so those two stay empty.

Verdict: **confirmed by source** (the docs examples do not cover a bare file name).

## 8. `path.win32` / `path.posix` exist on every platform and `path` is one of them

> "To achieve consistent results when working with Windows file paths on any operating system, use `path.win32`" (and the same for `path.posix`). "The API is accessible via `require('node:path').win32` or `require('node:path/win32')`." [docs]

In the source: `posix.win32 = win32.win32 = win32; posix.posix = win32.posix = posix;` (L1721-1722) and `module.exports = isWindows ? win32 : posix;` (L1728).

Caveat (src L220-228): `win32.resolve` on POSIX falls back to `process.cwd()`, which is a POSIX path. So `win32.resolve('/a')` returns `'\\a'` on Linux but `'C:\\a'` on Windows, and relative inputs give different results on each platform. `win32` only behaves the same everywhere for absolute drive or UNC inputs, which are the only inputs the probe gives it. The reverse case is handled: `posix.resolve` on Windows converts the cwd (`posixCwd`, L1239-1251).

Verdict: **confirmed by docs and source**, with the cwd caveat above.
