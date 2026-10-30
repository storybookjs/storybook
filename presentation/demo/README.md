# Grid overlay demo

A toolbar button toggles a layout grid over the story; the Node side serves the grid settings from `main.ts` options.

- `addon-grid-overlay/`: the addon as a user would publish it.
  - `src/node.ts`: the `defineAddon` entry (`./node` export).
  - `src/manager.tsx`: the toolbar tool.
  - `src/preview.ts`: the decorator and initial global.
  - `steps/01-*.ts` to `steps/05-*.ts`: the node entry growing one capability at a time; `05` equals `src/node.ts`.
  - `legacy-preset/`: the same addon written as a pre-instance preset, for comparison.
- `storybook/`: a React + Vite Storybook using `gridOverlay({ size: 16, color })`.

## Run

It uses this branch's packages through the repo root `node_modules`, so compile first:

```sh
yarn nx run-many -t compile -c production -p core ui manager storybook builder-vite react react-vite open-service
```

Then, from `presentation/demo/storybook`:

```sh
node ../../../node_modules/storybook/dist/bin/dispatcher.js dev -p 6170
```

- `build` instead of `dev -p 6170` builds it; the grid falls back to its default settings there, as no server serves the route.
- `curl http://localhost:6170/grid-overlay/settings` shows the Node side.
- Type check, from the repo root: `node node_modules/typescript/bin/tsc -p presentation/demo/tsconfig.json`.

## Headless

The same `.storybook` loads as an instance with no server and no manager.
Each script creates it with `mode: 'headless'`, reads the index, and closes it.

- `storybook/scripts/ci-check.ts`: a CI gate; fails when a component in `src/` has no story.
- `storybook/scripts/agent-tool.ts`: `findStories(query)`, a function an agent tool can call, plus a CLI entry.

From `presentation/demo/storybook`, after compiling:

```sh
node scripts/ci-check.ts
node scripts/agent-tool.ts button
```

- Add a `src/Badge.tsx` with no story to see the gate fail with exit code 1.
- Node runs the `.ts` files directly through its built-in type stripping, so Node 22.18 or later.

`main.ts` imports the addon by relative path because the demo has no install step; a published addon would be `import gridOverlay from 'storybook-addon-grid-overlay/node'`.
