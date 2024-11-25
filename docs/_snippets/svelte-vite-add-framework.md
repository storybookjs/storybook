```js filename=".storybook/main.js" renderer="svelte" language="js"
export default {
  // ...
  framework: '@storybook/svelte-vite', // 👈 Add this
};
```

```ts filename=".storybook/main.ts" renderer="svelte" language="ts"
import { StorybookConfig } from '@storybook/svelte-vite';

const config: StorybookConfig = {
  // ...
  framework: '@storybook/svelte-vite', // 👈 Add this
};

export default config;
```
