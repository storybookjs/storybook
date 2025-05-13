```js filename=".storybook/main.js" renderer="react" language="js"
export default {
  // ...
  features: {
    experimentalRSC: true,
  },
};
```

```ts filename=".storybook/main.ts" renderer="react" language="ts"
// Replace your-framework with nextjs or nextjs-vite
import type { StorybookConfig } from '@storybook/your-framework';

const config: StorybookConfig = {
  // ...
  features: {
    experimentalRSC: true,
  },
};

export default config;
```
