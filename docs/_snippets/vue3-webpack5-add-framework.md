```js filename=".storybook/main.js" renderer="vue" language="js"
export default {
  // ...
  framework: '@storybook/vue3-webpack5', // 👈 Add this
};
```

```ts filename=".storybook/main.ts" renderer="vue" language="ts"
import { StorybookConfig } from '@storybook/vue3-webpack5';

const config: StorybookConfig = {
  // ...
  framework: '@storybook/vue3-webpack5', // 👈 Add this
};

export default config;
```
