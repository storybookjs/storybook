```js filename=".storybook/main.ts" renderer="angular" language="ts" tabTitle="CSF (Legacy)"
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

```js filename=".storybook/main.ts" renderer="angular" language="ts" tabTitle="CSF"
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
