<h1>Storybook Storysource Addon</h1>

This addon is used to show stories source in the addon panel.

[Framework Support](https://storybook.js.org/docs/configure/integration/frameworks-feature-support)

![Storysource Demo](https://raw.githubusercontent.com/storybookjs/storybook/next/code/addons/storysource/docs/demo.gif)

- [Getting Started](#getting-started)
  - [Install using preset](#install-using-preset)
- [Theming](#theming)
- [Displaying full source](#displaying-full-source)

## Getting Started

First, install the addon

```sh
yarn add @storybook/addon-storysource --dev
```

You can add configuration for this addon by using a preset or by using the addon config with webpack

### Install using preset

Add the following to your `.storybook/main.js` exports:

```js
export default {
  addons: ['@storybook/addon-storysource'],
};
```

You can pass configurations into the addon-storysource loader in your `.storybook/main.js` file, e.g.:

```js
export default {
  addons: [
    {
      name: '@storybook/addon-storysource',
      options: {
        rule: {
          // test: [/\.stories\.jsx?$/], This is default
          include: [path.resolve(__dirname, '../src')], // You can specify directories
        },
        loaderOptions: {
          prettierConfig: { printWidth: 80, singleQuote: false },
        },
      },
    },
  ],
};
```

To customize the `source-loader`, pass `loaderOptions`. Valid configurations are documented in the [`source-loader` README](https://github.com/storybookjs/storybook/tree/next/code/lib/source-loader/README.md#options).

## Theming

Storysource will automatically use the light or dark syntax theme based on your storybook theme. See [Theming Storybook](https://storybook.js.org/docs/configure/user-interface/theming) for more information.

![Storysource Light/Dark Themes](https://raw.githubusercontent.com/storybookjs/storybook/next/code/addons/storysource/docs/theming-light-dark.png)

## Displaying full source

Storybook 6.0 introduced an unintentional change to `source-loader`, in which only the source of the selected story is shown in the addon. To restore the old behavior, pass the`injectStoryParameters: false` option.

If you're using `addon-docs`:

```js
export default {
  addons: [
    {
      name: '@storybook/addon-docs',
      options: {
        sourceLoaderOptions: {
          injectStoryParameters: false,
        },
      },
    },
  ],
};
```

If not:

```js
export default {
  addons: [
    {
      name: '@storybook/addon-storysource',
      options: {
        loaderOptions: {
          injectStoryParameters: false,
        },
      },
    },
  ],
};
```

This bug will be resolved in a future version of the addon.
