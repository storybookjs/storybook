```diff filename=".storybook/main.ts" renderer="angular" language="ts" tabTitle="CSF 4"
- import { defineMain } from '@storybook/angular/node';
+ import { defineMain } from '@storybook/angular-vite/node';

export default defineMain({
  // ...
-  framework: '@storybook/angular',
+  framework: '@storybook/angular-vite',
});
```

```diff filename=".storybook/main.ts" renderer="angular" language="ts" tabTitle="CSF 3"
// ⚠️ CSF 3 is deprecated and will be removed in Storybook 12
- import type { StorybookConfig } from '@storybook/angular';
+ import type { StorybookConfig } from '@storybook/angular-vite';

const config: StorybookConfig = {
  // ...
-  framework: '@storybook/angular',
+  framework: '@storybook/angular-vite',
};

export default config;
```
