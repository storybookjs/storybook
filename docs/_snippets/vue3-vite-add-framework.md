```js filename=".storybook/main.js" renderer="vue" language="js"
export default {
  // ...
  framework: '@storybook/vue3-vite', // 👈 Add this
};
```

```ts filename=".storybook/main.ts" renderer="vue" language="ts"
import { StorybookConfig } from '@storybook/vue3-vite';

const config: StorybookConfig = {
  // ...
  framework: '@storybook/vue3-vite', // 👈 Add this
};

export default config;
```
