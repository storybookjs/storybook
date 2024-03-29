---
title: 'babel'
---

Parent: [main.js|ts configuration](./main-config.md)

Type: `(config: Babel.Config, options: Options) => Babel.Config | Promise<Babel.Config>`

Customize Storybook's [Babel](https://babeljs.io/) setup.

<Callout variant="info" icon="💡">

[Addon authors](../addons/writing-presets.md#babel) should use [`babelDefault`](./main-config-babel-default.md) instead, which is applied to the preview config before any user presets have been applied.

</Callout>

<!-- prettier-ignore-start -->

<CodeSnippets
  paths={[
    'common/main-config-babel.js.mdx',
    'common/main-config-babel.ts.mdx',
  ]}
/>

<!-- prettier-ignore-end -->

## `Babel.Config`

The options provided by [Babel](https://babeljs.io/docs/options) are only applicable if you've enabled the [`@storybook/addon-webpack5-compiler-babel`](https://storybook.js.org/addons/@storybook/addon-webpack5-compiler-babel) addon.

<Callout variant="info">

If you have an existing Babel configuration file (e.g., `.babelrc`), it will be automatically detected and used by Storybook without any additional configuration required.

</Callout>

## `Options`

Type: `{ configType?: 'DEVELOPMENT' | 'PRODUCTION' }`

There are other options that are difficult to document here. Please introspect the type definition for more information.
