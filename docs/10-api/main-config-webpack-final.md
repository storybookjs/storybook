---
title: 'webpackFinal'
---

Parent: [main.js|ts configuration](./main-config.md)

Type: `async (config: Config, options: WebpackOptions) => Config`

Customize Storybook's Webpack setup when using the [webpack builder](../builders/webpack.md).

<CodeSnippets
paths={[
'common/main-config-webpack-final.js.mdx',
'common/main-config-webpack-final.ts.mdx',
]}
/>

## `Options`

Type: `{ configType?: 'DEVELOPMENT' | 'PRODUCTION' }`

There are other options that are difficult to document here. Please introspect the type definition for more information.
