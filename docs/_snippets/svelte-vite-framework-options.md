```js filename=".storybook/main.js" renderer="svelte" language="js"
export default {
  // ...
  framework: {
    name: '@storybook/svelte-vite',
    options: {
      // ...
    },
  },
};
```

```ts filename=".storybook/main.ts" renderer="svelte" language="ts"
import { StorybookConfig } from '@storybook/svelte-vite';

const config: StorybookConfig = {
  // ...
  framework: {
    name: '@storybook/svelte-vite',
    options: {
      // ...
    },
  },
};

export default config;
```
