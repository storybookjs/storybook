<!-- TODO: Needs vetting for Webpack-based and future framework support -->

```js filename=".storybook/main.js" renderer="common" language="js" tabTitle="CSF 3"
export default {
  framework: {
    name: '@storybook/your-framework',
    options: {},
  },
  swc: (config, options) => {
    return {
      ...config,
      // Apply your custom SWC configuration
    };
  },
};
```

```ts filename=".storybook/main.ts" renderer="common" language="ts" tabTitle="CSF 3"
import type { Options } from '@swc/core';
// Replace your-framework with the webpack-based framework you are using (e.g., react-webpack5)
import type { StorybookConfig } from '@storybook/your-framework';

const config: StorybookConfig = {
  framework: {
    name: '@storybook/your-framework',
    options: {},
  },
  swc: (config: Options, options): Options => {
    return {
      ...config,
      // Apply your custom SWC configuration
    };
  },
};

export default config;
```

```ts filename=".storybook/main.ts" renderer="react" language="ts" tabTitle="CSF Factory 🧪"
// Replace your-framework with the framework you are using (e.g., react-vite, nextjs, experimental-nextjs-vite)
import { defineMain } from '@storybook/your-framework/node';

import type { Options } from '@swc/core';

export default defineMain({
  framework: {
    name: '@storybook/your-framework',
    options: {},
  },
  swc: (config: Options, options): Options => {
    return {
      ...config,
      // Apply your custom SWC configuration
    };
  },
});
```

```js filename=".storybook/main.js" renderer="react" language="js" tabTitle="CSF Factory 🧪"
// Replace your-framework with the framework you are using (e.g., react-vite, nextjs, experimental-nextjs-vite)
import { defineMain } from '@storybook/your-framework/node';

export default defineMain({
  framework: {
    name: '@storybook/your-framework',
    options: {},
  },
  swc: (config, options) => {
    return {
      ...config,
      // Apply your custom SWC configuration
    };
  },
});
```
