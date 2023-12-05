---
title: 'previewBody'
---

Parent: [main.js|ts configuration](./main-config.md)

Type: `(body: string) => string`

Programmatically adjust the [preview `<body>`](../configure/story-rendering.md#adding-to-body) of your Storybook. Most often used by [addon authors](../addons/writing-presets.md#ui-configuration).

<Callout variant="info" icon="💡">

If you don't need to programmatically adjust the preview body, you can add scripts and styles to [`preview-body.html`](../configure/story-rendering.md#adding-to-body) instead.

</Callout>

For example, you can conditionally add scripts or styles, depending on the environment:

<CodeSnippets
paths={[
'common/main-config-preview-body.js.mdx',
'common/main-config-preview-body.ts.mdx',
]}
/>
