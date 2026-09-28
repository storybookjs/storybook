# Automigrations

An automigration (a "fix") describes a change to a user's project.
The runner owns everything around it: detection across projects, prompting, dry runs, reading and writing files, and reporting.

## Lifecycle

```
check ──▶ detection pass ──▶ prompt ──▶ apply pass ──▶ run ──▶ commit `files`
          (read, transform)              (read, transform, write)
```

- `check` gates the fix on things that are not file contents: dependencies, versions, flags.
  It returns a small result (paths and flags, not ASTs or generated code), or `null`.
- The detection pass streams the project's files once through the `transform` hooks of every fix that passed `check`, without writing.
  A fix with only `transform` applies when its hooks would change a file.
- After the prompt, the apply pass streams the files once more through the selected fixes' hooks and writes each changed file before reading the next one.
- `run` does what is not a per-file transform: dependency changes, `add()`, prompts, and file work through `files`.
  A dry run stops before the apply pass.

## `transform`

Modelled on Vite's `transform` hook.
`transform(options)` returns hooks for one project and pass, so a hook may keep state across the files of that pass.

```ts
transform: () => [
  {
    filter: { kind: ['main'] },
    handler: (code, { id }) => editConfigSource(code, id, (main) => main.set(['features', name], true)),
  },
],
```

- `filter.kind` selects `main`, `preview`, `manager`, `config` (anything else in the config directory), or `story` files, visited in that order; `filter.id` narrows by path.
- `handler(code, { id, kind })` receives the output of the fixes before it and returns new code, or `null` to leave the file unchanged.
- A handler that throws, or a file that cannot be read, skips that file for that fix only: the fix still migrates its other files, and later fixes still see the file.
  The runner writes every skipped file and the reason to `automigrations-summary.md` in the project root and points the user to it at the end of the run; a dry run only logs the list.
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

- Do not read or write project files with `node:fs` in a fix, loop with `p-limit`, branch on `dryRun`, or catch per-file errors.
  Path discovery (`existsSync`, globbing) is fine.
- `add()` and `removeAddon()` write `main.ts` directly; call them from `run`, which starts after the apply pass.
- Remove a fix once upgrades no longer start from a version that needs it.

## Tests

Use `checkFix` and `runFix` from `helpers/fix-test-utils.ts`; they run `check`, both passes, `run`, and the commit the way the runner does.
Redirect `node:fs/promises` to `memfs` as described in the repository's testing guidelines, and assert migrated files with inline snapshots.
