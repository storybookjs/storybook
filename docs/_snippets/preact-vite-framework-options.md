```js filename=".storybook/main.js" renderer="preact" language="js"
export default {
  framework: {
    name: '@storybook/preact-vite',
    options: {
      // ...
    },
  },
};
```

```ts filename=".storybook/main.ts" renderer="preact" language="ts"
import type { StorybookConfig } from '@storybook/preact-vite';

const config: StorybookConfig = {
  framework: {
    name: '@storybook/preact-vite',
    options: {
      // ...
    },
  },
};

export default config;
```
