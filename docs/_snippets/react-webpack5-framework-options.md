```js filename=".storybook/main.js" renderer="react" language="js"
export default {
  framework: {
    name: '@storybook/react-webpack5',
    options: {
      // ...
    },
  },
};
```

```ts filename=".storybook/main.ts" renderer="react" language="ts"
import type { StorybookConfig } from '@storybook/react-webpack5';

const config: StorybookConfig = {
  framework: {
    name: '@storybook/react-webpack5',
    options: {
      // ...
    },
  },
};

export default config;
```
