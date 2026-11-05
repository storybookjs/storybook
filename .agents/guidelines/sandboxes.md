# Sandbox Notes

This document is canonical for sandbox generation and use: where sandboxes live, the sandbox command shape, and the common templates. `AGENTS.md` owns the pointer to this file.

Sandboxes are generated outside the repository at `../storybook-sandboxes/` by default.

- `STORYBOOK_SANDBOX_ROOT=./sandbox` forces local output, but is usually not preferred
- `./sandbox` inside the repo mainly exists for NX outputs, not CI sandboxes
- If sandbox generation fails, fall back to `cd code && pnpm storybook:ui`

Generate and use a sandbox with the same `sandbox` command shape used elsewhere in this file:

```bash
pnpm task sandbox --template react-vite/default-ts --start-from auto
# Same sandbox step via NX
pnpm exec nx sandbox react-vite/default-ts -c production
cd ../storybook-sandboxes/react-vite-default-ts
pnpm install
pnpm storybook
```

Each sandbox is a standalone pnpm project with its own `pnpm-workspace.yaml`.
In the default linked mode, it installs every monorepo package from `code/` as a `file:` dependency: a snapshot that each task running in the sandbox (`dev`, `build`, `serve`, ...) refreshes when it starts.
A rebuild, including `build --watch`, does not reach a sandbox dev server that is already running, and `pnpm install` inside the sandbox does not pick it up either.
After rebuilding, stop the dev server and start it again with `pnpm task dev --template react-vite/default-ts --start-from auto`, which refreshes the linked packages first. While the old server still answers on its port, `--start-from auto` treats `dev` as done and skips it.

Common templates:

- `react-vite/default-ts`
- `react-webpack/default-ts`
- `angular-cli/default-ts`
- `svelte-vite/default-ts`
- `vue3-vite/default-ts`
- `nextjs/default-ts`
