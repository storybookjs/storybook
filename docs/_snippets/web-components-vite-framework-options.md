```js filename=".storybook/main.js" renderer="web-components" language="js"
export default {
  framework: {
    name: '@storybook/web-components-vite',
    options: {
      // ...
    },
  },
};
```

```ts filename=".storybook/main.ts" renderer="web-components" language="ts"
import type { StorybookConfig } from '@storybook/web-components-vite';

const config: StorybookConfig = {
  framework: {
    name: '@storybook/web-components-vite',
    options: {
      // ...
    },
  },
};

export default config;
```
