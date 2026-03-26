```ts filename=".storybook/main.ts" renderer="angular" language="ts" tabTitle="CSF 3"
import type { StorybookConfig } from '@storybook/angular';

const config: StorybookConfig = {
  stories: [
    /* ... */
  ],
  addons: [
    /* ... */
  ],
  framework: {
    name: '@storybook/angular',
    options: {
      enableNgcc: false,
    },
  },
};

export default config;
```

```ts filename=".storybook/main.ts" renderer="angular" language="ts" tabTitle="CSF Next 🧪"
import { defineMain } from '@storybook/angular/node';

const config = defineMain({
  stories: [
    /* ... */
  ],
  addons: [
    /* ... */
  ],
  framework: {
    name: '@storybook/angular',
    options: {
      enableNgcc: false,
    },
  },
});

export default config;
```
