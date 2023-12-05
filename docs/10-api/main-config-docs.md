---
title: 'docs'
---

Parent: [main.js|ts configuration](./main-config.md)

Type:

```ts
{
  autodocs?: boolean | 'tag';
  defaultName?: string;
  docsMode?: boolean;
}
```

Configures Storybook's [auto-generated documentation](../writing-docs/autodocs.md).

## `autodocs`

Type: `boolean | 'tag'`

Default: `'tag'`

Enables or disables automatic documentation for stories.

- `true`: Enables it for all stories
- `false`: Disables it for all stories
- `'tag'`: Enables it for stories tagged with `'autodocs'`

<CodeSnippets
paths={[
'common/main-config-docs-autodocs.js.mdx',
'common/main-config-docs-autodocs.ts.mdx',
]}
/>

## `defaultName`

Type: `string`

Default: `'Docs'`

Name used for generated documentation pages.

<CodeSnippets
paths={[
'common/main-config-docs-default-name.js.mdx',
'common/main-config-docs-default-name.ts.mdx',
]}
/>

## `docsMode`

Type: `boolean`

Only show documentation pages in the sidebar (usually set with the `--docs` CLI flag).

<CodeSnippets
paths={[
'common/main-config-docs-docs-mode.js.mdx',
'common/main-config-docs-docs-mode.ts.mdx',
]}
/>
