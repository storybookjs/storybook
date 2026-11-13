# build.static: cause

- Where it fails: `storybook build` (run by `pnpm run build`) in `packages/frontend/@n8n/storybook`. Logs: `build-attempt-1-default-heap.log`, `build-attempt-2-default-heap.log`.
- Error: `Worker terminated due to reaching memory limit: JS heap out of memory` (`ERR_WORKER_OUT_OF_MEMORY`), then `Storybook exited with an error`, exit 1.
- Where the server-side docgen comes from: `.storybook/main.ts:37` sets `framework.options.docgen: 'vue-docgen-api'`. In 11.0.0-beta.2, `docgenServer` is on by default for Vue 3 (migration guide, section "`docgenServer` is stable and enabled by default"). The docgen worker runs in `storybook/dist/component-meta/index.js`. Its message reports a limit of about 2240 MB.
- Why it fails: the docgen worker exhausts its heap while it reads the design-system components. In 10.5.10 the builder ran docgen in the main build process, and the guide says builder docgen was the default before 11.0.0. The baseline build was not run, so this is not a measured regression.
- Fix tried: `NODE_OPTIONS=--max-old-space-size=4480` (the value Storybook suggests). The build then exits 0 and writes `storybook-static` with 819 entries (`build.log`).
- Not tried: `features.docgenServer: false` in `main.ts`. Not done, because the project uses the default.
- Reproduced: twice, with default heap.
