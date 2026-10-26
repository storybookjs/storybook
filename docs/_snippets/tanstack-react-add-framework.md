```diff filename=".storybook/main.ts" renderer="react" language="ts" tabTitle="CSF 4"
- import { defineMain } from '@storybook/react-vite/node';
+ import { defineMain } from '@storybook/tanstack-react/node';

export default defineMain({
  // ...
-  framework: '@storybook/react-vite',
+  framework: '@storybook/tanstack-react',
});
```

```diff filename=".storybook/main.ts" renderer="react" language="ts" tabTitle="CSF 3"
// ⚠️ CSF versions 1, 2, and 3 will be removed in a future version of Storybook. Upgrade to CSF 4: https://storybook.js.org/docs/writing-stories/csf#upgrade-to-csf-4
- import type { StorybookConfig } from '@storybook/react-vite';
+ import type { StorybookConfig } from '@storybook/tanstack-react';

const config: StorybookConfig = {
  // ...
-  framework: '@storybook/react-vite',
+  framework: '@storybook/tanstack-react',
};

export default config;
```
