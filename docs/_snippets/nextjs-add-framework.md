```diff filename=".storybook/main.js" renderer="react" language="js" tabTitle="CSF 4"
- import { defineMain } from '@storybook/your-previous-framework/node';
+ import { defineMain } from '@storybook/nextjs/node';

export default defineMain({
  // ...
-  framework: '@storybook/react-webpack5',
+  framework: '@storybook/nextjs',
});
```

```diff filename=".storybook/main.ts" renderer="react" language="ts" tabTitle="CSF 4"
- import { defineMain } from '@storybook/your-previous-framework/node';
+ import { defineMain } from '@storybook/nextjs/node';

export default defineMain({
  // ...
-  framework: '@storybook/react-webpack5',
+  framework: '@storybook/nextjs',
});
```

```diff filename=".storybook/main.ts" renderer="react" language="ts" tabTitle="CSF 3"
// ⚠️ CSF versions 1, 2, and 3 will be removed in a future version of Storybook. Upgrade to CSF 4: https://storybook.js.org/docs/writing-stories/csf#upgrade-to-csf-4
- import type { StorybookConfig } from '@storybook/your-previous-framework';
+ import type { StorybookConfig } from '@storybook/nextjs';

const config: StorybookConfig = {
  // ...
-  framework: '@storybook/react-webpack5',
+  framework: '@storybook/nextjs',
};

export default config;
```

```diff filename=".storybook/main.js" renderer="react" language="js" tabTitle="CSF 3"
// ⚠️ CSF versions 1, 2, and 3 will be removed in a future version of Storybook. Upgrade to CSF 4: https://storybook.js.org/docs/writing-stories/csf#upgrade-to-csf-4
export default {
  // ...
-  framework: '@storybook/react-webpack5',
+  framework: '@storybook/nextjs',
};
```
