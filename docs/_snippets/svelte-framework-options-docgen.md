```js filename=".storybook/main.js" renderer="svelte" language="js"
// Replace your-framework with the framework you are using, e.g. sveltekit or svelte-vite
export default {
  features: {
    docgenServer: false, // Turn off server-side docgen
  },
  framework: {
    name: '@storybook/your-framework',
    options: {
      docgen: false, // Turn off builder docgen
    },
  },
};
```

```ts filename=".storybook/main.ts" renderer="svelte" language="ts"
// Replace your-framework with the framework you are using, e.g. sveltekit or svelte-vite
import type { StorybookConfig } from '@storybook/your-framework';

const config: StorybookConfig = {
  features: {
    docgenServer: false, // Turn off server-side docgen
  },
  framework: {
    name: '@storybook/your-framework',
    options: {
      docgen: false, // Turn off builder docgen
    },
  },
};

export default config;
```
