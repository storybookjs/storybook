```js filename=".storybook/main.js" renderer="svelte" language="js"
export default {
  // ...
  framework: '@storybook/svelte-webpack5', // 👈 Add this
};
```

```ts filename=".storybook/main.ts" renderer="svelte" language="ts"
import { StorybookConfig } from '@storybook/svelte-webpack5';

const config: StorybookConfig = {
  // ...
  framework: '@storybook/svelte-webpack5', // 👈 Add this
};

export default config;
```
