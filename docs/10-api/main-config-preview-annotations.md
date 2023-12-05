---
title: 'previewAnnotations'
---

Parent: [main.js|ts configuration](./main-config.md)

Type: `string[] | ((config: string[], options: Options) => string[] | Promise<string[]>)`

Add additional scripts to run in the story preview.

<Callout variant="info" icon="💡">

Mostly used by [frameworks](../contribute/framework.md#previewjs-example). Storybook users and [addon authors](../addons/writing-presets.md) should add scripts to [`preview.js`](../configure/index.md#configure-story-rendering) instead.

</Callout>

```ts
// @storybook/nextjs framework's src/preset.ts

import type { StorybookConfig } from './types';

export const previewAnnotations: StorybookConfig['previewAnnotations'] = (entry = []) => [
  ...entry,
  require.resolve('@storybook/nextjs/preview.js'),
];
```
