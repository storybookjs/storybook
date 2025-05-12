```js filename=".storybook/main.js" renderer="vue" language="js"
export default {
  framework: {
    name: '@storybook/vue3-vite',
    options: {
      docgen: 'vue-component-meta',
    },
  },
};
```

```ts filename=".storybook/main.ts" renderer="vue" language="ts"
import type { StorybookConfig } from '@storybook/vue3-vite';

const config: StorybookConfig = {
  framework: {
    name: '@storybook/vue3-vite',
    options: {
      docgen: 'vue-component-meta',
    },
  },
};

export default config;
```
