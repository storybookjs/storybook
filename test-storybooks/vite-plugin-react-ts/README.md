# vite-plugin-react-ts

A React + TypeScript Vite app that consumes Storybook through `experimental_vitePlugin` from
`@storybook/builder-vite`, instead of running `storybook dev`. It verifies that the plugin can
serve Storybook from inside a user's own Vite dev server.

Storybook packages are linked to the local repo via `resolutions`, so compile the monorepo first
(`yarn task compile` from the repo root).

## Usage

```bash
yarn install
yarn dev
```

- The app is served at `http://localhost:5173/`
- Storybook is served by the same dev server at `http://localhost:5173/__storybook/`

To serve Storybook at the root instead (no app), run Vite in the dedicated mode:

```bash
yarn storybook
```

To build a static Storybook in `storybook-static/`, run:

```bash
yarn storybook:build
```

## What to check

- `/__storybook/` renders the manager UI
- `/__storybook/index.json` lists `example-button--primary`
- Selecting a story renders it in the preview iframe
- Editing `src/Button.tsx` hot-reloads the story without a full page reload

## E2E tests

Playwright tests in `e2e-tests/` boot `yarn dev` and verify the app at `/` plus Storybook at
`/__storybook/` (manager, preview iframe, and `index.json`). They run in CI as the
`test-storybooks-vite-plugin` job, which also smoke-tests `yarn storybook:build`.

```bash
yarn playwright-e2e
```
