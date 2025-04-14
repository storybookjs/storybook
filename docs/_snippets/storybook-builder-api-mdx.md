```ts filename="mdx-plugin.ts" renderer="common" language="ts"
import mdx from 'vite-plugin-mdx';

import { createCompiler } from '@storybook/csf-tools/mdx';

export function mdxPlugin() {
  return mdx((filename) => {
    const compilers = [];

    if (filename.endsWith('stories.mdx') || filename.endsWith('story.mdx')) {
      compilers.push(createCompiler({}));
    }
    return {
      compilers,
    };
  });
}
```
