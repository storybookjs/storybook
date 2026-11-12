# Server Kitchen Sink

This is a demo app to test a standalone server using integration with Storybook using `@storybook/server`.

Unlike the rest of the repository, which uses pnpm, this project uses Yarn 4 on purpose, pinned by the `packageManager` field in its `package.json`. If your global `yarn` is not that version, run `corepack enable yarn` once, or run `bash .github/actions/setup-node-and-install/package-managers/install.sh yarn` from the repository root. Then compile the Storybook packages with `pnpm task compile` from the repository root.

Run `yarn install` to sync the Storybook modules with the source.

Run `yarn start` to start.

This starts an ExpressJS server on port `1337` and Storybook on port `9006`.
