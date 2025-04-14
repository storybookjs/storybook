```js filename=".storybook/main.js" renderer="web-components" language="js"
export default {
  // ...
  framework: '@storybook/web-components-vite', // 👈 Add this
};
```

```ts filename=".storybook/main.ts" renderer="web-components" language="ts"
import { StorybookConfig } from '@storybook/web-components-vite';

const config: StorybookConfig = {
  // ...
  framework: '@storybook/web-components-vite', // 👈 Add this
};

export default config;
```
