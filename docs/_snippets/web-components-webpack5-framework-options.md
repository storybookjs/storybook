```js filename=".storybook/main.js" renderer="web-components" language="js"
export default {
  // ...
  framework: {
    name: '@storybook/web-components-webpack5',
    options: {
      // ...
    },
  },
};
```

```ts filename=".storybook/main.ts" renderer="web-components" language="ts"
import type { StorybookConfig } from '@storybook/web-components-webpack5';

const config: StorybookConfig = {
  framework: {
    name: '@storybook/web-components-webpack5',
    options: {
      // ...
    },
  },
};

export default config;
```
