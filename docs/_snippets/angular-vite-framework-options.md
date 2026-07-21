```ts filename=".storybook/main.ts" renderer="angular" language="ts" tabTitle="CSF 3"
import type { StorybookConfig } from '@storybook/angular-vite';

const config: StorybookConfig = {
  framework: {
    name: '@storybook/angular-vite',
    options: {
      // ...
    },
  },
};

export default config;
```

```ts filename=".storybook/main.ts" renderer="angular" language="ts" tabTitle="CSF Next 🧪"
import { defineMain } from '@storybook/angular-vite/node';

const config = defineMain({
  framework: {
    name: '@storybook/angular-vite',
    options: {
      // ...
    },
  },
});

export default config;
```
