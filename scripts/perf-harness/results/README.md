# Results

`bench.mjs` writes one folder per invocation here, unless you pass `--out <dir>`.
Everything in this folder except this file is ignored by git.

Each folder holds:

- `meta.json`: workload, project, builds, machine, and options.
- `before-<n>.json`, `after-<n>.json`: raw measurements of run `n`, one file per build.
- `before-<n>.json.server.log`, `after-<n>.json.server.log`: dev server output of that run.
- `report.md`: the table to paste into a PR description.
- `summary.json`: the medians behind `report.md`.

Do not commit results. They hold machine paths and can be large.
