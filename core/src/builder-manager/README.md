# Manager-Builder

> NOTE: Do not use this package unless you know what you are doing.

This package is used internally by Storybook to create the manager side (UI) of Storybook.

This package uses `esbuild` to bundle the manager-side of addons, and prepare it for modern, ESM supporting browsers.

Each addon is bundled into a separate file, and the manager is responsible for loading them.
If a `manager.*` file exists in the config dir (e.g. `.storybook`), it's also bundled, and loaded in the browser.

Additionally, this package also will add the manager ui via the `@storybook/ui` package, which is already built by `esbuild` in our build process before publishing.
