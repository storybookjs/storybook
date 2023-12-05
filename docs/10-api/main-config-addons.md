---
title: 'addons'
---

Parent: [main.js|ts configuration](./main-config.md)

Type: `(string | { name: string; options?: AddonOptions })[]`

Registers the [addons](../addons/install-addons.md) loaded by Storybook.

For each addon's available options, see their respective [documentation](https://storybook.js.org/integrations).

<CodeSnippets
paths={[
'common/main-config-addons.js.mdx',
'common/main-config-addons.ts.mdx',
]}
/>
