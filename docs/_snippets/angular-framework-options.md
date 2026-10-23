```js filename=".storybook/main.ts" renderer="angular" language="ts" tabTitle="CSF 4"
import { defineMain } from '@storybook/angular/node';

const config = defineMain({
  framework: {
    name: '@storybook/angular',
    options: {
      // ...
    },
  },
});

export default config;
```

```js filename=".storybook/main.ts" renderer="angular" language="ts" tabTitle="CSF 3"
// ⚠️ CSF 3 is deprecated and will be removed in Storybook 12
import type { StorybookConfig } from '@storybook/angular';

const config: StorybookConfig = {
  framework: {
    name: '@storybook/angular',
    options: {
      // ...
    },
  },
};

export default config;
```
