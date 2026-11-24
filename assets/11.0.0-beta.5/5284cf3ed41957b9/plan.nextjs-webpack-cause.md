# plan.nextjs-webpack: cause of the blank preview after the automigration

- File: .storybook/main.ts. The nextjs-to-nextjs-vite automigration changed the framework to @storybook/nextjs-vite and kept webpackFinal, which holds the TsconfigPathsPlugin that resolved the tsconfig `paths` (@docs/*, @mantine/*, @mantinex/*, @mantine-tests/*, @/*). Vite ignores webpackFinal.
- Why it fails: Vite does not apply those paths. The import of "@docs/styles-api" falls back to node_modules, where packages/@docs/styles-api/package.json points main/module/exports at unbuilt output (./cjs/index.cjs, ./esm/index.mjs). Vite logs "Failed to resolve entry for package "@docs/styles-api"" and the preview fails with an internal server error. The manager shows the loading spinner (plan-nextjs-vite-dev.log, nextjs-webpack-vite.png).
- Fix tried: viteFinal in .storybook/main.ts sets resolve.alias from the tsconfig path entries (regex per prefix to packages/<scope>/$1/src). After this the story renders (plan-vite-iframe.png, nextjs-webpack-vite-after.png).
- The migration guide does not mention that webpackFinal path aliases are dropped by the Vite framework.
