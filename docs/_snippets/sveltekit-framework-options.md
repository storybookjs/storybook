```js filename=".storybook/main.js" renderer="svelte" language="js"
export default {
  // ...
  framework: {
    name: '@storybook/sveltekit',
    options: {
      // ...
    },
  },
};
```

```ts filename=".storybook/main.ts" renderer="svelte" language="ts"
import { StorybookConfig } from '@storybook/sveltekit';

const config: StorybookConfig = {
  // ...
  framework: {
    name: '@storybook/sveltekit',
    options: {
      // ...
    },
  },
};

export default config;
```
