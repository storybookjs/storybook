<!-- TODO: Vet this for CSF Next support -->

```js filename=".storybook/main.js" renderer="common" language="js" tabTitle="CSF 3"
export default {
  viteFinal: async (config, options) => {
    // Update config here
    return config;
  },
  webpackFinal: async (config, options) => {
    // Change webpack config
    return config;
  },
  babel: async (config, options) => {
    return config;
  },
};
```

```js filename=".storybook/main.js" renderer="react" language="js" tabTitle="CSF Next 🧪"
// Replace your-framework with the framework you are using (e.g., react-vite, nextjs, experimental-nextjs-vite)
import { defineMain } from '@storybook/your-framework/node';

export default defineMain({
  viteFinal: async (config, options) => {
    // Update config here
    return config;
  },
  webpackFinal: async (config, options) => {
    // Change webpack config
    return config;
  },
  babel: async (config, options) => {
    return config;
  },
});
```

```ts filename=".storybook/main.ts" renderer="common" language="ts" tabTitle="CSF 3"
// Replace your-framework with the framework you are using (e.g., react-vite, vue3-vite)
import type { StorybookConfig } from '@storybook/your-framework';

const config: StorybookConfig = {
  viteFinal: async (config, options) => {
    // Update config here
    return config;
  },
  webpackFinal: async (config, options) => {
    // Change webpack config
    return config;
  },
  babel: async (config, options) => {
    return config;
  },
};

export default config;
```

```ts filename=".storybook/main.ts" renderer="react" language="ts" tabTitle="CSF Next 🧪"
// Replace your-framework with the framework you are using (e.g., react-vite, nextjs, experimental-nextjs-vite)
import { defineMain } from '@storybook/your-framework/node';

export default defineMain({
  viteFinal: async (config, options) => {
    // Update config here
    return config;
  },
  webpackFinal: async (config, options) => {
    // Change webpack config
    return config;
  },
  babel: async (config, options) => {
    return config;
  },
});
```
