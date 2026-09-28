# Automigrations

An automigration (a "fix") describes a change to a user's project.
The runner owns everything around it: detection across projects, prompting, dry runs, reading and writing files, and reporting.

## Lifecycle

```
check ──▶ detection pass ──▶ prompt ──▶ run + commit `files` ──▶ apply pass
          (read, transform)                                        (read, transform, write)
```

- `check` gates the fix on things that are not file contents: dependencies, versions, flags.
  It returns a small result (paths and flags, not ASTs or generated code), or `null`.
- The detection pass decides whether a fix with `transform` and no `run` applies: it streams the project's files through those hooks without writing, and the fix applies when a hook would change or fail on a file.
  Detection stops running a fix's hooks at its first such file, and stops reading once every fix has an answer.
  Detection failures are reported only if the user selects the fix and the apply pass hits them.
  A fix with its own `run` applies on its `check` alone, so its hooks do not run during detection.
- After the prompt, each selected fix's `run` does what is not a per-file transform: dependency changes, `add()`, prompts, and file work through `files`.
  Before a `run`, the runner tries the fix's `main` hooks without writing; a fix whose hooks cannot migrate the main config fails before its `run` changes anything.
  A fix whose `run` throws keeps none of its `files` edits and its hooks skip the apply pass, but dependency changes and `add()` already happened, so do everything that can fail before them.
  `run` can also resolve `false` to decline, for example when the user cancels a prompt; the fix keeps no edits and is reported as skipped.
- The apply pass then streams the files once more through the hooks of the fixes that ran, and writes each changed file before reading the next one, so it sees what `run` and `add()` wrote.
  A dry run stops before `run` and writes nothing, not even the summary.

## `transform`

Modelled on Vite's `transform` hook.
`transform(options)` returns hooks for one project and pass, so a hook may keep state across the files of that pass.
Detection can stop early, so `run` cannot rely on anything a hook recorded; find it in `check` with `files.read` instead.

```ts
transform: () => [
  { filter: { kind: ['main'] }, editConfig: (main) => main.set(['features', name], true) },
  {
    filter: { kind: ['preview', 'story'], code: 'componentSubtitle' },
    editConfig: migrate,
    editCsf: (csf) => csf.objects({ stories: false }).forEach(migrate),
  },
],
```

- `filter.kind` selects `main`, `preview`, `manager`, `config` (other scripts in the config directory, outside `node_modules` and `dist`), or `story` files, visited in that order; `filter.id` narrows by path, and `filter.code` skips files whose current code does not contain that string or match that pattern.
  Each file has one kind whichever fixes run: a story inside the config directory is a `story`, and the manager config is a `manager`, so list every kind a hook needs.
- A hook either edits the parsed file or rewrites its text.
  `editConfig(config, { id, kind })` receives a `ConfigFile` for every kind except `story`, and `editCsf(csf, { id, kind })` receives a `CsfFile` for stories.
  Edits only see script files: MDX, Svelte, and Vue stories reach `handler` hooks only.
  Consecutive edits share one parse, and the runner prints the file after each edit.
  `handler(code, { id, kind })` receives the output of the fixes before it and returns new code, or `null` to leave the file unchanged; use it for text edits such as renaming an import.
- A hook that throws, an edit that leaves mutation diagnostics, or a file that cannot be read or parsed skips that file for that fix only: the fix still migrates its other files, and later fixes see the file as the last successful hook left it.
  The runner writes every skipped file and the reason to `automigrations-summary.md` in the project root and points the user to it at the end of the run.
- A fix fails when its hooks fail on the main config, and then leaves the other files alone; otherwise it succeeds and reports the files it skipped.
  `storybook automigrate` exits with an error while any fix failed or skipped files.
- The summary keeps a fix's section until the fix runs again, or until the detection pass finds nothing left for it to change.
- The runner formats a file that an edit changed with the project's formatter before writing it, so hooks neither check diagnostics nor format; a file that only `handler` hooks changed is written as returned.
- Hooks see `\n` line endings; a CRLF file is written back with CRLF.
- Files that no active hook asks for are never read.

## `files`

For work that does not fit a per-file transform, such as deleting files or edits that depend on several files at once, `check` and `run` receive `files`.
Its edits are staged and committed after `run` resolves, and the commit refuses to overwrite a file that changed on disk after it was read.

| Method                   | Stages                                                                                    |
| ------------------------ | ----------------------------------------------------------------------------------------- |
| `read(path)`             | nothing; returns the file, including earlier edits of the same fix                        |
| `write(path, content)`   | the complete contents of a file                                                           |
| `remove(path)`           | the deletion of a file                                                                    |
| `edit(paths, transform)` | each changed result; tries every file, then throws one error listing each failed file     |
| `editConfig(path, edit)` | a `ConfigFile` edit of a main, preview, or manager config; throws on mutation diagnostics |

## Rules

- Do not read or write project files with `node:fs` in a fix, loop with `p-limit`, branch on `dryRun`, or catch per-file errors outside `check`; the runner reports a file that fails in a hook or cannot be read.
  Path discovery (`existsSync`, globbing) is fine.
- `add()` and `removeAddon()` write `main.ts` directly; call them from `run`, which finishes before the apply pass reads the file.
- Remove a fix once upgrades no longer start from a version that needs it.

## Tests

Use `checkFix` and `runFix` from `helpers/fix-test-utils.ts`; they run `check`, both passes, `run`, and the commit the way the runner does.
Redirect `node:fs/promises` to `memfs` as described in the repository's testing guidelines, and assert migrated files with inline snapshots.
