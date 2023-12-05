---
title: 'viteFinal'
---

Parent: [main.js|ts configuration](./main-config.md)

Type: `(config: Vite.InlineConfig, options: Options) => Vite.InlineConfig | Promise<Vite.InlineConfig>`

Customize Storybook's Vite setup when using the [Vite builder](../builders/vite.md).

<CodeSnippets
paths={[
'common/main-config-vite-final.js.mdx',
'common/main-config-vite-final.ts.mdx',
]}
/>

## `Options`

Type: `{ configType?: 'DEVELOPMENT' | 'PRODUCTION' }`

There are other options that are difficult to document here. Please introspect the type definition for more information.
