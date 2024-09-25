```js filename=".storybook/main.js" renderer="react" language="js"
export default {
  // ...
  features: {
    experimentalRSC: true,
  },
};
```

```ts filename=".storybook/main.ts" renderer="react" language="ts"
import { StorybookConfig } from '@storybook/nextjs';

const config: StorybookConfig = {
  // ...
  features: {
    experimentalRSC: true,
  },
};

export default config;
```

