```js filename=".storybook/main.js" renderer="vue" language="js"
export default {
  framework: {
    name: '@storybook/vue3-webpack5',
    options: {
      // ...
    },
  },
};
```

```ts filename=".storybook/main.ts" renderer="vue" language="ts"
import type { StorybookConfig } from '@storybook/vue-webpack5';

const config: StorybookConfig = {
  framework: {
    name: '@storybook/vue3-webpack5',
    options: {
      // ...
    },
  },
};

export default config;
```
