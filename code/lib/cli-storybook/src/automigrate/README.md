# Automigrations

An automigration (a "fix") describes a change to a user's project.
The runner owns everything around it: detection across projects, prompting, dry runs, writing files, and reporting.

## Lifecycle

```
check({ files: scratch }) ──result or null──▶ prompt ──▶ run({ files, result }) ──resolves──▶ commit
        │                                       │                    │
  staged edits are discarded          --dry-run stops here     throws: nothing is written
```

- `check` decides whether the fix applies and returns a small result (paths and flags, not ASTs or generated code).
  It may stage the same edits as `run` on its scratch `files` to learn whether anything would change.
- `run` stages its edits on `files`.
  The runner commits them only after `run` resolves, so a dry run never reaches `run` and a throwing fix writes nothing.
- The commit refuses to overwrite a file that changed on disk after the fix read it.

## `files`

| Method                     | Stages                                                                                   |
| -------------------------- | ---------------------------------------------------------------------------------------- |
| `read(path)`               | nothing; returns the file, including earlier edits of the same fix                       |
| `write(path, content)`     | the complete contents of a file                                                          |
| `remove(path)`             | the deletion of a file                                                                   |
| `edit(paths, transform)`   | each changed result; tries every file, then throws one error listing each failed file    |
| `editConfig(path, edit)`   | a `ConfigFile` edit of a main, preview, or manager config; throws on mutation diagnostics |

## Rules

- Do not read or write project files with `node:fs` in a fix, loop with `p-limit`, branch on `dryRun`, or catch per-file errors.
  Path discovery (`existsSync`, globbing) is fine.
- `add()` and `removeAddon()` still write `main.ts` directly.
  Call them before staging edits to the same files, or the commit fails because the file changed after it was read.
- Use `loadAnnotationFile` from `storybook/internal/csf-tools` when a migration edits both preview and story annotations; keep inheritance rules in the migration.
- Remove a fix once upgrades no longer start from a version that needs it.

## Tests

Use `checkFix` and `runFix` from `helpers/fix-test-utils.ts`; they create `files` and commit the way the runner does.
Redirect `node:fs/promises` to `memfs` as described in the repository's testing guidelines, and assert migrated files with inline snapshots.
