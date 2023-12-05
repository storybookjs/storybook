---
title: 'managerHead'
---

Parent: [main.js|ts configuration](./main-config.md)

Type: `(head: string) => string`

Programmatically adjust the manager's `<head>` of your Storybook. For example, load a custom font or add a script. Most often used by [addon authors](../addons/writing-presets.md#ui-configuration).

<Callout variant="info" icon="💡">

If you don't need to programmatically adjust the manager head, you can add scripts and styles to `manager-head.html` instead.

</Callout>

For example, you can conditionally add scripts or styles, depending on the environment:

<CodeSnippets
paths={[
'common/main-config-manager-head.js.mdx',
'common/main-config-manager-head.ts.mdx',
]}
/>
