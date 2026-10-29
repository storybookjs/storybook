```js filename=".storybook/main.js" renderer="react" language="js" tabTitle="CSF 4"
// Replace your-framework with the framework you are using (e.g., react-vite, nextjs, nextjs-vite)
import { defineMain } from '@storybook/your-framework/node';

export default defineMain({
  framework: {
    name: '@storybook/your-framework',
    options: {},
  },
  swc: (config, options) => ({
    jsc: {
      transform: {
        react: {
          runtime: 'automatic',
        },
      },
    },
  }),
});
```

```ts filename=".storybook/main.ts" renderer="react" language="ts" tabTitle="CSF 4"
// Replace your-framework with the framework you are using (e.g., react-vite, nextjs, nextjs-vite)
import { defineMain } from '@storybook/your-framework/node';

export default defineMain({
  framework: {
    name: '@storybook/your-framework',
    options: {},
  },
  swc: (config, options) => ({
    jsc: {
      transform: {
        react: {
          runtime: 'automatic',
        },
      },
    },
  }),
});
```

```ts filename=".storybook/main.ts" renderer="common" language="ts" tabTitle="CSF 3"
// ⚠️ CSF versions 1, 2, and 3 will be removed in a future version of Storybook. Upgrade to CSF 4: https://storybook.js.org/docs/writing-stories/csf#upgrade-to-csf-4
// Replace your-framework with the webpack-based framework you are using (e.g., react-webpack5)
import type { StorybookConfig } from '@storybook/your-framework';

const config: StorybookConfig = {
  framework: {
    name: '@storybook/your-framework',
    options: {},
  },
  swc: (config, options) => ({
    jsc: {
      transform: {
        react: {
          runtime: 'automatic',
        },
      },
    },
  }),
};

export default config;
```

```js filename=".storybook/main.js" renderer="common" language="js" tabTitle="CSF 3"
// ⚠️ CSF versions 1, 2, and 3 will be removed in a future version of Storybook. Upgrade to CSF 4: https://storybook.js.org/docs/writing-stories/csf#upgrade-to-csf-4
export default {
  framework: {
    name: '@storybook/your-framework',
    options: {},
  },
  swc: (config, options) => ({
    jsc: {
      transform: {
        react: {
          runtime: 'automatic',
        },
      },
    },
  }),
};
```
