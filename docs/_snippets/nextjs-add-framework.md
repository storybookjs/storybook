```diff filename=".storybook/main.js" renderer="react" language="js" tabTitle="CSF (Legacy)"
export default {
  // ...
-  framework: '@storybook/react-webpack5',
+  framework: '@storybook/nextjs',
};
```

```diff filename=".storybook/main.ts" renderer="react" language="ts" tabTitle="CSF (Legacy)"
- import type { StorybookConfig } from '@storybook/your-previous-framework';
+ import type { StorybookConfig } from '@storybook/nextjs';

const config: StorybookConfig = {
  // ...
-  framework: '@storybook/react-webpack5',
+  framework: '@storybook/nextjs',
};

export default config;
```

```diff filename=".storybook/main.ts" renderer="react" language="ts" tabTitle="CSF"
- import { defineMain } from '@storybook/your-previous-framework/node';
+ import { defineMain } from '@storybook/nextjs/node';

export default defineMain({
  // ...
-  framework: '@storybook/react-webpack5',
+  framework: '@storybook/nextjs',
});
```

<!-- JS snippets still needed while providing both CSF 3 & Next -->

```diff filename=".storybook/main.js" renderer="react" language="js" tabTitle="CSF"
- import { defineMain } from '@storybook/your-previous-framework/node';
+ import { defineMain } from '@storybook/nextjs/node';

export default defineMain({
  // ...
-  framework: '@storybook/react-webpack5',
+  framework: '@storybook/nextjs',
});
```
