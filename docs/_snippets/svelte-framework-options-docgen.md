```js filename=".storybook/main.js" renderer="svelte" language="js"
export default {
  features: {
    docgenServer: false, // Turn off server-side docgen
  },
  framework: {
    name: '@storybook/svelte-vite', // or '@storybook/sveltekit'
    options: {
      docgen: false, // Turn off builder docgen
    },
  },
};
```

```ts filename=".storybook/main.ts" renderer="svelte" language="ts"
import type { StorybookConfig } from '@storybook/svelte-vite';

const config: StorybookConfig = {
  features: {
    docgenServer: false, // Turn off server-side docgen
  },
  framework: {
    name: '@storybook/svelte-vite', // or '@storybook/sveltekit'
    options: {
      docgen: false, // Turn off builder docgen
    },
  },
};

export default config;
```
