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

```ts filename=".storybook/main.ts" renderer="react" language="ts" tabTitle="CSF Next 🧪"
import type { Options } from '@swc/core';

// Replace your-framework with the framework you are using (e.g., react-vite, nextjs, nextjs-vite)
import { defineMain } from '@storybook/your-framework/node';

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

<!-- JS snippets still needed while providing both CSF 3 & Next -->

```js filename=".storybook/main.js" renderer="react" language="js" tabTitle="CSF Next 🧪"
// Replace your-framework with the framework you are using (e.g., react-vite, nextjs, nextjs-vite)
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

```ts filename=".storybook/main.ts" renderer="vue" language="ts" tabTitle="CSF Next 🧪"
import type { Options } from '@swc/core';

import { defineMain } from '@storybook/vue3-vite/node';

export default defineMain({
  framework: {
    name: '@storybook/vue3-vite',
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

<!-- JS snippets still needed while providing both CSF 3 & Next -->

```js filename=".storybook/main.js" renderer="vue" language="js" tabTitle="CSF Next 🧪"
import { defineMain } from '@storybook/vue3-vite/node';

export default defineMain({
  framework: {
    name: '@storybook/vue3-vite',
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
