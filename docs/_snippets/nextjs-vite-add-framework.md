```diff filename=".storybook/main.js" renderer="react" language="js" tabTitle="CSF (Legacy)"
export default {
  // ...
-  framework: '@storybook/react-webpack5',
+  framework: '@storybook/nextjs-vite',
};
```

```diff filename=".storybook/main.ts" renderer="react" language="ts" tabTitle="CSF (Legacy)"
- import type { StorybookConfig } from '@storybook/your-previous-framework';
+ import type { StorybookConfig } from '@storybook/nextjs-vite';

const config: StorybookConfig = {
  // ...
-  framework: '@storybook/react-webpack5',
+  framework: '@storybook/nextjs-vite',
};

export default config;
```

```diff filename=".storybook/main.ts" renderer="react" language="ts" tabTitle="CSF"
- import { defineMain } from '@storybook/your-previous-framework/node';
+ import { defineMain } from '@storybook/nextjs-vite/node';

export default defineMain({
  // ...
-  framework: '@storybook/react-webpack5',
+  framework: '@storybook/nextjs-vite',
});
```

<!-- JS snippets still needed while providing both CSF 3 & Next -->

```diff filename=".storybook/main.js" renderer="react" language="js" tabTitle="CSF"
- import { defineMain } from '@storybook/your-previous-framework/node';
+ import { defineMain } from '@storybook/nextjs-vite/node';

export default defineMain({
  // ...
-  framework: '@storybook/react-webpack5',
+  framework: '@storybook/nextjs-vite',
});
```
