# Create React App preset for Storybook

One-line [Create React App](https://github.com/facebook/create-react-app) configuration for Storybook.

This preset is designed to use alongside [`@storybook/react`](https://github.com/storybookjs/storybook/tree/master/app/react).

## Compatibility

From version 4.0.0 onwards, the `@storybook/preset-create-react-app` is compatible with Create React App version 5 and later. If you're using an earlier version of Create React App, you can still utilize the preset's previous versions.

## Basic usage

**Note: you don't need to do this manually** if you used `npx -p @storybook/cli sb init` on a create-react-app, everything should properly setup already ✅.

First, install this preset to your project.

```sh
# Yarn
yarn add -D @storybook/preset-create-react-app

# npm
npm install -D @storybook/preset-create-react-app
```

Once installed, add this preset to the appropriate file:

- `./.storybook/main.js` (for Storybook 5.3.0 and newer)

  ```js
  module.exports = {
    addons: ['@storybook/preset-create-react-app'],
  };
  ```

- `./.storybook/presets.js` (for all Storybook versions)

  ```js
  module.exports = ['@storybook/preset-create-react-app'];
  ```

## Advanced usage

### Usage with Docs

When working with Storybook Docs, simply add the following config to your `main.js` file.

```js
module.exports = {
  addons: [
    '@storybook/preset-create-react-app',
    {
      name: '@storybook/addon-docs',
      options: {
        configureJSX: true,
      },
    },
  ],
};
```

### CRA overrides

This preset uses CRA's Webpack/Babel configurations, so that Storybook's behavior matches your app's behavior.

However, there may be some cases where you'd rather override CRA's default behavior. If that is something you need, you can use the `craOverrides` object.

| Option               | Default          | Behaviour | Type       | Description                                                                                                        |
| -------------------- | ---------------- | --------- | ---------- | ------------------------------------------------------------------------------------------------------------------ |
| `fileLoaderExcludes` | `['ejs', 'mdx']` | Extends   | `string[]` | Excludes file types (by extension) from CRA's `file-loader` configuration. The defaults are required by Storybook. |

Here's how you might configure this preset to ignore PDF files so they can be processed by another preset or loader:

```js
module.exports = {
  addons: [
    {
      name: '@storybook/preset-create-react-app',
      options: {
        craOverrides: {
          fileLoaderExcludes: ['pdf'],
        },
      },
    },
  ],
};
```

### Custom `react-scripts` packages

In most cases, this preset will find your `react-scripts` package, even if it's a fork of the official `react-scripts`.

In the event that it doesn't, you can set the package's name with `scriptsPackageName`.

```js
module.exports = {
  addons: [
    {
      name: '@storybook/preset-create-react-app',
      options: {
        scriptsPackageName: '@my/react-scripts',
      },
    },
  ],
};
```

### Warning for forks of 'react-scripts'

One of the tasks that this preset does is inject the storybook config directory (the default is `.storybook`)
into the `includes` key of the webpack babel-loader config that react-scripts (or your fork) provides. This is
nice because then any components/code you've defined in your storybook config directory will be run through the
babel-loader as well.

The potential gotcha exists if you have tweaked the Conditions of the webpack babel-loader rule in your fork of
react-scripts. This preset will make the `include` condition an array (if not already), and inject the storybook
config directory. If you have changed the conditions to utilize an `exclude`, then BOTH conditions will need to
be true (which isn't likely going to work as expected).

The steps to remedy this would be to follow the steps for customizing the webpack config within the storybook
side of things. [Details for storybook custom webpack config](https://storybook.js.org/docs/configurations/custom-webpack-config/)
You'll have access to all of the rules in `config.module.rules`. You'll need to find the offending rule,
and customize it how you need it to be to be compatible with your fork.

See [Webpack Rule Conditions](https://webpack.js.org/configuration/module/#rule-conditions) for more details
concerning the conditions.

## Resources

- [Walkthrough to set up Storybook Docs with CRA & typescript](https://gist.github.com/shilman/bc9cbedb2a7efb5ec6710337cbd20c0c)
- [Example projects (used for testing this preset)](https://github.com/storybookjs/presets/tree/master/examples)
