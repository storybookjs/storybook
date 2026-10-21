# shell-git-env: paths in shell commands, child processes, git pathspecs, PATH and env vars

Probe: `poc/path-separators/probes/shell-git-env.mjs`. Repo code modelled:

- `scripts/run-registry.ts` builds `cd "${resolvedLocation}" && yarn pack --out="${PACKS_DIRECTORY}/..."` and runs it with `exec`.
- `code/lib/eslint-plugin/scripts/generate-rule.ts` runs `execSync(\`code "${ruleFile}"\`)`.
- `code/core/src/telemetry/get-application-file-count.ts` builds `${basePath}${sep}*${match}*.${ext}` and runs `git ls-files -- ...globs` (`storybook-metadata.ts` passes `dirname(packageJsonPath)` as `basePath`).
- `code/core/src/common/utils/command.ts` splits `process.env.PATH` with `node:path` `delimiter`.

Installed versions: pathe 2.0.3 (root `node_modules/pathe`), pathe 1.1.2 (`code/core/node_modules/pathe` and `scripts/node_modules/pathe`; both workspaces declare `"pathe": "^1.1.2"`). Linux run used git 2.43.0 and Node 22.22.0.

## 1. Shell commands with `/` paths (`exec`/`execSync`, cmd.exe on Windows)

**Claim.** With the default shell (cmd.exe on Windows), `node "<C:/... script>"` and `cd "<C:/... dir>" && node -e ...` work. Some cmd builtins (`type`, `dir`, `copy`) misread `/` as the start of a switch.

**Node docs.** [child_process.exec](https://nodejs.org/docs/latest-v22.x/api/child_process.html#child_processexeccommand-options-callback): `shell` "**Default:** `'/bin/sh'` on Unix, `process.env.ComSpec` on Windows." [Shell requirements](https://nodejs.org/docs/latest-v22.x/api/child_process.html#shell-requirements): "If the shell is `'cmd.exe'`, it should understand the `/d /s /c` switches". [Default Windows shell](https://nodejs.org/docs/latest-v22.x/api/child_process.html#default-windows-shell): "`'cmd.exe'` is used as a fallback if `process.env.ComSpec` is unavailable." `windowsVerbatimArguments` "is set to `true` automatically when `shell` is specified and is CMD". In other words, Node passes the command string to cmd.exe unchanged. Node does not rewrite separators, so cmd.exe's own parser is what matters.

[Spawning .bat and .cmd files on Windows](https://nodejs.org/docs/latest-v22.x/api/child_process.html#spawning-bat-and-cmd-files-on-windows): "`.bat` and `.cmd` files are not executable on their own without a terminal ... can be invoked using `child_process.spawn()` with the `shell` option set, with `child_process.exec()`, or by spawning `cmd.exe` ... if the script filename contains spaces it needs to be quoted."

**Microsoft docs.** The pages for [`dir`](https://learn.microsoft.com/en-us/windows-server/administration/windows-commands/dir), [`type`](https://learn.microsoft.com/en-us/windows-server/administration/windows-commands/type) and [`copy`](https://learn.microsoft.com/en-us/windows-server/administration/windows-commands/copy) give the syntax as `/x` switches next to `[<drive>:][<path>]` operands. Examples:

- `dir [<drive>:][<path>][<filename>] [...] [/p] [/q] [/w] [/d] [/a...] ... [/b] ...`
- `copy [/d] [/v] [/n] [/y | /-y] [/z] [/a | /b] <source> [/a | /b] ...`. Here `/a` and `/b` are also valid *after* an operand.
- `type`: "If your `<filename>` contains spaces, you must enclose it in quotation marks".

None of these pages says whether `/` inside a path is accepted, or how quoting interacts with switch parsing. **The docs are silent.** The cmd.exe parser is closed source, so the probe's Windows run is the only authority here. Prediction from general cmd behaviour: quoted `/` paths work, while unquoted `/` segments are taken as switches. For example, `dir C:/x/files` would read `/x` as a switch, and in `copy` an unquoted `/a...` segment can hit a real switch. An unquoted relative command such as `files/hello.cmd` is split at `/`, so cmd looks for a command named `files`.

`node "<C:/...>"` and `cd "<C:/...>"`: once cmd hands over the argument, `node.exe` resolves the script path through the Win32 API (libuv), and Win32 accepts `/`. `cd` is a builtin, and its handling of `/` is not documented either.

The probe also covers `if exist "<C:/...>"` and running a `.cmd` by its quoted absolute `/` path.

**Verdict.** The `node` and `cd` parts are **undetermined (needs Windows run)**; the docs neither confirm nor rule them out. For the cmd builtins, the docs are silent, so this is also **undetermined (needs Windows run)**. On POSIX the `sh` equivalents work (confirmed by the Linux run).

## 2. `spawnSync` (no shell) of non-node executables with `/` paths

**Claim.** `spawnSync('git', ['-C', 'C:/...', ...])` works on Windows.

**Docs.** With `shell: false`, Node passes argv to `CreateProcess` after quoting. Separators are not mentioned anywhere in the [child_process docs](https://nodejs.org/docs/latest-v22.x/api/child_process.html); whether `/` works is up to the callee. For git, `git -C <path>` calls `chdir()`, and Git for Windows (MINGW) treats `/` and `\` alike. In git source v2.47.0, [`compat/win32/path-utils.h` L9](https://github.com/git/git/blob/v2.47.0/compat/win32/path-utils.h#L9) has `#define is_dir_sep is_xplatform_dir_sep`, and [`git-compat-util.h` L286-289](https://github.com/git/git/blob/v2.47.0/git-compat-util.h#L286-L289) defines it as `return c == '/' || c == '\\';`. The probe also checks the command itself in `/` form (`C:/.../node.exe`) and `cwd` in `/` form.

Git's own output uses `/` (`rev-parse --show-toplevel` prints `C:/...` on Git for Windows). The probe records this as `git.output.show-toplevel`.

**Verdict.** **Confirmed by source** for git. The Node and libuv side, where the command is in `/` form, is **undetermined (needs Windows run)**.

## 3. git pathspecs: `src/`, `src\`, absolute in both forms, the telemetry globs

**Claim.** Pathspecs built with native `sep` must stay native. On Windows, `C:\repo\src\*page*.tsx` contains `\*`, which looks like a glob escape.

**Docs.** [gitglossary: pathspec](https://git-scm.com/docs/gitglossary#Documentation/gitglossary.txt-aiddefpathspecapathspec): "the pathspec up to the last slash represents a directory prefix ... Paths relative to the directory prefix will be matched against that pattern using fnmatch(3); in particular, `*` and `?` *can* match directory separators." The glossary does not mention absolute pathspecs or backslashes. **The docs are silent on Windows.**

**Source (git v2.47.0).**

- [`pathspec.c` L490](https://github.com/git/git/blob/v2.47.0/pathspec.c#L490): unless the pathspec uses `:(top)` or prefix magic, every pathspec goes through `prefix_path_gently(prefix, prefixlen, &prefixlen, copyfrom)`.
- [`setup.c` L123-150](https://github.com/git/git/blob/v2.47.0/setup.c#L123-L150) handles both cases:
  - Absolute paths: `normalize_path_copy_len(...)`, then `abspath_part_inside_repo(...)`, which strips the worktree and makes the path repo-relative.
  - Relative paths: `prefix + path` goes through the same `normalize_path_copy_len`.
- [`path.c` L1016-1080](https://github.com/git/git/blob/v2.47.0/path.c#L1016-L1080): every run of `is_dir_sep` characters becomes a single `'/'` (`*dst++ = '/'`). On Windows `is_dir_sep` includes `\` (see claim 2).

So Git for Windows turns every `\` in a command-line pathspec into `/` before glob matching. As a result:

- `src\` matches the same files as `src/`.
- `C:\repo\src\` matches the same files as `C:/repo/src/`.
- `C:\repo\src\*page*.tsx` becomes `src/*page*.tsx`. The `\*` is *not* treated as an escape.

The flip side is that a backslash can never escape a glob character on Windows. Git's test suite confirms this. [`t/test-lib.sh` L1718-1720](https://github.com/git/git/blob/v2.47.0/t/test-lib.sh#L1718-L1720) sets the `BSLASHPSPEC` prerequisite only on non-Windows platforms, and [`t/t3700-add.sh` L308](https://github.com/git/git/blob/v2.47.0/t/t3700-add.sh#L308) gates `git add 'fo\[ou\]bar'` on it. Johannes Sixt explained the trade-off on the mailing list ([git ML, 2011](https://lore.kernel.ime.usp.br/git/4E54CF1F.7020608@kdbg.org/)), and commit [6fd1106a](https://git.lorimer.id.au/gitweb.git/diff/6fd1106aa4f921dd8e80895ed837072adfd665f1) ("t3700: Skip a test with backslashes in pathspec") notes "first thing git does with a pathspec from the command line is to convert backslashes to forward slashes".

There is a related detail in the telemetry globs. Without `:(glob)` magic, `*` crosses `/`, so `<base>/*Screen*.tsx` also counts `src/nested/LoginScreen.tsx`. The Linux run confirms this. It is not separator-related, but it means the telemetry count is recursive.

Git output (`ls-files`) is always `/`-separated and relative to the cwd. The Linux run confirms this.

**Verdict.**

- On Windows, `src\` and absolute native pathspecs match like their `/` forms: **confirmed by source**. Expected on Windows: `git.pathspec.*.backslash/native` and `telemetry-globs.native` return the same files as the `/` forms.
- Using `/` in the telemetry globs instead of `sep` is equally safe: **confirmed by source**. The "must stay native for git" reason in `get-application-file-count.ts` and `storybook-metadata.ts` is **contradicted**: either form works.

## 4. `PATH` delimiter vs pathe `delimiter`

**Claim.** `process.env.PATH` uses `;` on Windows. Splitting it with pathe's `delimiter` (`:`) breaks drive letters.

**Docs and source.**

- Node: [path.delimiter](https://nodejs.org/docs/latest-v22.x/api/path.html#pathdelimiter): "`;` for Windows, `:` for POSIX".
- **pathe 1.1.2** (`code/core/node_modules/pathe/dist/shared/pathe.ff20891b.mjs` L14): `const delimiter = ":";`. It is a constant on every platform. Source: [unjs/pathe v1.1.2 `src/path.ts`](https://github.com/unjs/pathe/blob/v1.1.2/src/path.ts). Splitting a Windows `PATH` with it yields `C`, `\Windows\system32;C`, and so on. The probe shows this deterministically on any platform with `path.sample-windows-path.split.pathe1`.
- **pathe 2.0.3** (`node_modules/pathe/dist/index.mjs` L4): `const delimiter = (() => globalThis.process?.platform === "win32" ? ";" : ":")();`. The named export is platform-dependent. However, the **default export** is the `posix` proxy (`mix(":")`, L16 and L19), so `import path from 'pathe'; path.delimiter` is still `":"` on Windows. `win32.delimiter` is `";"`. The README (`node_modules/pathe/README.md` L42) states it: behaviour is POSIX "regardless of ... running platform (the only exception is `delimiter` constant export, it will be set to `;` on windows platform)". Source: [unjs/pathe v2.0.3 `src/index.ts`](https://github.com/unjs/pathe/blob/v2.0.3/src/index.ts).

**Verdict.**

- For pathe 1.1.2, which is what `code/core` and `scripts` resolve: **confirmed by source**.
- For pathe 2.0.3, the claim is **contradicted** for `import { delimiter } from 'pathe'` but holds for the default export's `.delimiter`.

`command.ts` must keep `node:path` (or pathe ≥2's named export). Migrating it to `pathe` in `code/core` today would break Windows.

## 5. Env var round-trip

**Claim.** `X=<C:/...>` passed to a child Node process is read back verbatim.

**Docs.** [child_process options.env](https://nodejs.org/docs/latest-v22.x/api/child_process.html#child_processspawncommand-args-options) describes "Environment key-value pairs". The only Windows-specific note concerns *key* case-insensitivity: "Node.js lexicographically sorts the `env` keys and uses the first one that case-insensitively matches", for example `PATH` vs `Path`. The docs mention no transformation of values. That is plausible since the Win32 environment block is opaque strings, but **the docs do not state it outright**.

The probe also checks `%X%` expansion in cmd and `$X` in sh.

**Verdict.** **Undetermined (needs Windows run)**, though no transformation is expected. Confirmed on Linux.

## Summary

| Claim | Docs verdict |
| --- | --- |
| 1. shell `node`/`cd` with `/` paths | undetermined (needs Windows run) |
| 1. cmd builtins `type`/`dir`/`copy` with `/` (quoted vs unquoted) | undetermined (needs Windows run); MS docs silent |
| 2. `spawnSync git -C C:/...` | confirmed by source (git); Node side needs Windows run |
| 3. git pathspecs with `\` on Windows | confirmed by source (git converts `\` to `/` first); "must stay native" contradicted |
| 4. pathe `delimiter` is `:` | confirmed by source for 1.1.2; contradicted for pathe 2.0.3 named export |
| 5. env var round-trip verbatim | undetermined (needs Windows run); docs silent on values |
