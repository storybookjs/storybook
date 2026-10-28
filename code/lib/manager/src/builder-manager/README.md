# Manager-Builder

> NOTE: Do not use this package unless you know what you are doing.

This package is used internally by Storybook to create the manager side (UI) of Storybook.

This package uses `esbuild` to bundle the manager-side of addons, and prepare it for modern, ESM supporting browsers.

Each addon is bundled into a separate file, and the manager is responsible for loading them.
If a `manager.*` file exists in the config dir (e.g. `.storybook`), it's also bundled, and loaded in the browser.

The manager UI itself comes from `@storybook/manager` (`src/ui`), prebuilt into its `dist/ui` before publishing.
