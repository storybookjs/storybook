---
title: 'swc'
---

Parent: [main.js|ts configuration](./main-config.md)

Type: `(config: swc.Options, options: Options) => swc.Options | Promise<swc.Options>`

Customize Storybook's [SWC](https://swc.rs/) setup.

<CodeSnippets
paths={[
'common/main-config-swc.js.mdx',
'common/main-config-swc.ts.mdx',
]}
/>

## `SWC.Options`

See SWC's [documentation](https://swc.rs/) for more information.

## Options

Type: `{ configType?: 'DEVELOPMENT' | 'PRODUCTION' }`

There are other options that are difficult to document here. Please introspect the type definition for more information.
