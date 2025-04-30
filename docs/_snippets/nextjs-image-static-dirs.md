```js filename=".storybook/main.js" renderer="react" language="js"
export default {
  // ...
  staticDirs: [
    {
      from: '../src/components/fonts',
      to: 'src/components/fonts',
    },
  ],
};
```

```ts filename=".storybook/main.ts" renderer="react" language="ts"
// Replace your-framework with nextjs or nextjs-vite
import type { StorybookConfig } from '@storybook/your-framework';

const config: StorybookConfig = {
  // ...
  staticDirs: [
    {
      from: '../src/components/fonts',
      to: 'src/components/fonts',
    },
  ],
};

export default config;
```
