```ts filename=".storybook/main.ts" renderer="angular" language="ts" tabTitle="CSF 3"
import { StorybookConfig } from '@storybook/angular';

const config: StorybookConfig = {
  // ...
  framework: '@storybook/angular', // 👈 Add this
};

export default config;
```

```ts filename=".storybook/main.ts" renderer="angular" language="ts" tabTitle="CSF Next 🧪"
import { defineMain } from '@storybook/angular/node';

export default defineMain({
  // ...
  framework: '@storybook/angular', // 👈 Add this
});
```
