```js filename=".storybook/main.js" renderer="common" language="js"
export default {
  security: {
    insecureIframeMessaging: true,
  },
};
```

```ts filename=".storybook/main.ts" renderer="common" language="ts"
// Replace your-framework with the framework you are using (e.g., react-webpack5, vue3-vite)
import type { StorybookConfig } from '@storybook/your-framework';

const config: StorybookConfig = {
  security: {
    insecureIframeMessaging: true,
  },
};

export default config;
```
