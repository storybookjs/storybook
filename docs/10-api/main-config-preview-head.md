---
title: 'previewHead'
---

Parent: [main.js|ts configuration](./main-config.md)

Type: `(head: string) => string`

Programmatically adjust the [preview `<head>`](../configure/story-rendering.md#adding-to-head) of your Storybook. Most often used by [addon authors](../addons/writing-presets.md#ui-configuration).

<Callout variant="info" icon="💡">

If you don't need to programmatically adjust the preview head, you can add scripts and styles to [`preview-head.html`](../configure/story-rendering.md#adding-to-head) instead.

</Callout>

For example, you can conditionally add scripts or styles, depending on the environment:

<CodeSnippets
paths={[
'common/main-config-preview-head.js.mdx',
'common/main-config-preview-head.ts.mdx',
]}
/>
