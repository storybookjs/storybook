```js filename=".storybook/main.js" renderer="vue" language="js" tabTitle="CSF 3 JS"
export default {
  framework: {
    name: '@storybook/vue3-vite',
    options: {
      docgen: 'vue-component-meta',
    },
  },
};
```

```ts filename=".storybook/main.ts" renderer="vue" language="ts" tabTitle="CSF 3 TS"
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

```ts filename=".storybook/main.ts" renderer="vue" language="ts" tabTitle="CSF Next 🧪"
import { defineMain } from '@storybook/vue3-vite/node';

export default defineMain({
  framework: {
    name: '@storybook/vue3-vite',
    options: {
      docgen: 'vue-component-meta',
    },
  },
});
```
