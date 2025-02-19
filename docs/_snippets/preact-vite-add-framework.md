```js filename=".storybook/main.js" renderer="preact" language="js"
export default {
  // ...
  // framework: '@storybook/preact-webpack5', 👈 Remove this
  framework: '@storybook/preact-vite', // 👈 Add this
};
```

```ts filename=".storybook/main.ts" renderer="preact" language="ts"
import { StorybookConfig } from '@storybook/preact-vite';

const config: StorybookConfig = {
  // ...
  // framework: '@storybook/preact-webpack5', 👈 Remove this
  framework: '@storybook/preact-vite', // 👈 Add this
};

export default config;
```
