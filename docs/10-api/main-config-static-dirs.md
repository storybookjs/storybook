---
title: 'staticDirs'
---

Parent: [main.js|ts configuration](./main-config.md)

Type: `(string | { from: string; to: string })[]`

Sets a list of directories of [static files](../configure/images-and-assets.md#serving-static-files-via-storybook-configuration) to be loaded by Storybook.

<CodeSnippets
paths={[
'common/main-config-static-dirs.js.mdx',
'common/main-config-static-dirs.ts.mdx',
]}
/>

## With configuration objects

You can also use a configuration object to define the directories:

<CodeSnippets
paths={[
'common/main-config-static-dirs-with-object.js.mdx',
'common/main-config-static-dirs-with-object.ts.mdx',
]}
/>
