```diff filename=".storybook/main.ts" renderer="angular" language="ts" tabTitle="CSF 3"
- import type { StorybookConfig } from '@storybook/angular';
+ import type { StorybookConfig } from '@storybook/angular-vite';

const config: StorybookConfig = {
  // ...
-  framework: '@storybook/angular',
+  framework: '@storybook/angular-vite',
};

export default config;
```

```diff filename=".storybook/main.ts" renderer="angular" language="ts" tabTitle="CSF Next 🧪"
- import { defineMain } from '@storybook/angular/node';
+ import { defineMain } from '@storybook/angular-vite/node';

export default defineMain({
  // ...
-  framework: '@storybook/angular',
+  framework: '@storybook/angular-vite',
});
```
