```diff filename=".storybook/main.ts" renderer="react" language="ts" tabTitle="CSF 3"
- import type { StorybookConfig } from '@storybook/react-vite';
+ import type { StorybookConfig } from '@storybook/tanstack-react';

const config: StorybookConfig = {
  // ...
-  framework: '@storybook/react-vite',
+  framework: '@storybook/tanstack-react',
};

export default config;
```

```diff filename=".storybook/main.ts" renderer="react" language="ts" tabTitle="CSF Next 🧪"
- import { defineMain } from '@storybook/react-vite/node';
+ import { defineMain } from '@storybook/tanstack-react/node';

export default defineMain({
  // ...
-  framework: '@storybook/react-vite',
+  framework: '@storybook/tanstack-react',
});
```

<!-- JS snippets still needed while providing both CSF 3 & Next -->
