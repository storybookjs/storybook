```js filename=".storybook/main.js" renderer="svelte" language="js"
export default {
  // ...
  framework: {
    name: '@storybook/svelte-webpack5',
    options: {
      // ...
    },
  },
};
```

```ts filename=".storybook/main.ts" renderer="svelte" language="ts"
import { StorybookConfig } from '@storybook/svelte-webpack5';

const config: StorybookConfig = {
  // ...
  framework: {
    name: '@storybook/svelte-webpack5',
    options: {
      // ...
    },
  },
};

export default config;
```
