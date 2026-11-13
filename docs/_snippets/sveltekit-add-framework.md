```js filename=".storybook/main.js" renderer="svelte" language="js"
export default {
  // ...
  framework: '@storybook/sveltekit', // 👈 Add this
  // svelteOptions: { ... }, 👈 Remove this
  addons: [
    // '@storybook/addon-svelte-csf', 👈 Remove this
  ],
};
```

```ts filename=".storybook/main.ts" renderer="svelte" language="ts"
import type { StorybookConfig } from '@storybook/sveltekit';

const config: StorybookConfig = {
  // ...
  framework: '@storybook/sveltekit', // 👈 Add this
  // svelteOptions: { ... }, 👈 Remove this
  addons: [
    // '@storybook/addon-svelte-csf', 👈 Remove this
  ],
};

export default config;
```
