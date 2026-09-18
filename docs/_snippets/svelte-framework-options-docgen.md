```js filename=".storybook/main.js" renderer="svelte" language="js"
// Replace your-framework with svelte-vite or sveltekit
export default {
  framework: {
    name: '@storybook/your-framework',
    options: {
      docgen: false, // Disable docgen for better performance
    },
  },
};
```

```ts filename=".storybook/main.ts" renderer="svelte" language="ts"
// Replace your-framework with svelte-vite or sveltekit
import type { StorybookConfig } from '@storybook/your-framework';

const config: StorybookConfig = {
  framework: {
    name: '@storybook/your-framework',
    options: {
      docgen: false, // Disable docgen for better performance
    },
  },
};

export default config;
```
