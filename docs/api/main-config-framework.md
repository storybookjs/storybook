---
title: 'framework'
---

(**Required**)

Parent: [main.js|ts configuration](./main-config.md)

Type: `FrameworkName | { name: FrameworkName; options?: FrameworkOptions }`

Configures Storybook based on a set of [framework-specific](../configure/frameworks.md) settings.

<!-- prettier-ignore-start -->

<CodeSnippets
  paths={[
    'common/main-config-framework.js.mdx',
    'common/main-config-framework.ts.mdx',
  ]}
/>

<!-- prettier-ignore-end -->

## `name`

Type: `string`

For available frameworks and their options, see their respective [documentation](https://github.com/storybookjs/storybook/tree/next/code/frameworks).

## `options`

Type: `Record<string, any>`

While many options are specific to a framework, there are some options that are shared across some frameworks, e.g. those that configure Storybook's [builder](./main-config-core.md#builder).

### `options.builder`

Type: `Record<string, any>`

Configures Storybook's builder, [Vite](../builders/vite.md) or [Webpack](../builders/webpack.md).
