```js filename=".storybook/main.js" renderer="react" language="js"
export default {
  framework: {
    name: '@storybook/react-vite',
    options: {
      // ...
    },
  },
};
```

```ts filename=".storybook/main.ts" renderer="react" language="ts"
import type { StorybookConfig } from '@storybook/react-vite';

const config: StorybookConfig = {
  framework: {
    name: '@storybook/react-vite',
    options: {
      // ...
    },
  },
};

export default config;
```
