---
title: 'babel'
---

Parent: [main.js|ts configuration](./main-config.md)

Type: `(config: Babel.Config, options: Options) => Babel.Config | Promise<Babel.Config>`

Customize Storybook's [Babel](https://babeljs.io/) setup.

<Callout variant="info" icon="💡">

[Addon authors](../addons/writing-presets.md#babel) should use [`babelDefault`](./main-config-babel-default.md) instead, which is applied to the preview config before any user presets have been applied.

</Callout>

<CodeSnippets
paths={[
'common/main-config-babel.js.mdx',
'common/main-config-babel.ts.mdx',
]}
/>

## `Babel.Config`

See [Babel docs](https://babeljs.io/docs/options).

## `Options`

Type: `{ configType?: 'DEVELOPMENT' | 'PRODUCTION' }`

There are other options that are difficult to document here. Please introspect the type definition for more information.
