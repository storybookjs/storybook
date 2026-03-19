```js filename=".storybook/main.js" renderer="common" language="js" tabTitle="CSF 3"
export default {
  stories: [],
  addons: [
    // Other Storybook addons
    {
      name: '@storybook/addon-coverage',
      options: {
        istanbul: {
          include: ['**/stories/**'],
          exclude: ['**/exampleDirectory/**'],
        },
      },
    },
  ],
};
```

```ts filename=".storybook/main.ts" renderer="common" language="ts" tabTitle="CSF 3"
// For Vite support add the following import
// import type { AddonOptionsVite } from '@storybook/addon-coverage';

import type { AddonOptionsWebpack } from '@storybook/addon-coverage';

// Replace your-framework with the framework and builder you are using (e.g., react-webpack5, vue3-webpack5)
import type { StorybookConfig } from '@storybook/your-framework';

const coverageConfig: AddonOptionsWebpack = {
  istanbul: {
    include: ['**/stories/**'],
    exclude: ['**/exampleDirectory/**'],
  },
};

const config: StorybookConfig = {
  stories: [],
  addons: [
    // Other Storybook addons
    {
      name: '@storybook/addon-coverage',
      options: coverageConfig,
    },
  ],
};

export default config;
```

```ts filename=".storybook/main.ts" renderer="react" language="ts" tabTitle="CSF Next 🧪"
// Replace your-framework with the framework you are using (e.g., react-vite, nextjs, nextjs-vite)
import { defineMain } from '@storybook/your-framework/node';

// For Vite support add the following import
// import type { AddonOptionsVite } from '@storybook/addon-coverage';
import type { AddonOptionsWebpack } from '@storybook/addon-coverage';

const coverageConfig: AddonOptionsWebpack = {
  istanbul: {
    include: ['**/stories/**'],
    exclude: ['**/exampleDirectory/**'],
  },
};

export default defineMain({
  stories: [],
  addons: [
    // Other Storybook addons
    {
      name: '@storybook/addon-coverage',
      options: coverageConfig,
    },
  ],
});
```

<!-- JS snippets still needed while providing both CSF 3 & Next -->

```js filename=".storybook/main.js" renderer="react" language="js" tabTitle="CSF Next 🧪"
// Replace your-framework with the framework you are using (e.g., react-vite, nextjs, nextjs-vite)
import { defineMain } from '@storybook/your-framework/node';

export default defineMain({
  stories: [],
  addons: [
    // Other Storybook addons
    {
      name: '@storybook/addon-coverage',
      options: {
        istanbul: {
          include: ['**/stories/**'],
          exclude: ['**/exampleDirectory/**'],
        },
      },
    },
  ],
});
```

```ts filename=".storybook/main.ts" renderer="vue" language="ts" tabTitle="CSF Next 🧪"
import { defineMain } from '@storybook/vue3-vite/node';

import type { AddonOptionsVite } from '@storybook/addon-coverage';

const coverageConfig: AddonOptionsVite = {
  istanbul: {
    include: ['**/stories/**'],
    exclude: ['**/exampleDirectory/**'],
  },
};

export default defineMain({
  framework: '@storybook/vue3-vite',
  stories: [],
  addons: [
    // Other Storybook addons
    {
      name: '@storybook/addon-coverage',
      options: coverageConfig,
    },
  ],
});
```

<!-- JS snippets still needed while providing both CSF 3 & Next -->

```js filename=".storybook/main.js" renderer="vue" language="js" tabTitle="CSF Next 🧪"
import { defineMain } from '@storybook/vue3-vite/node';

export default defineMain({
  framework: '@storybook/vue3-vite',
  stories: [],
  addons: [
    // Other Storybook addons
    {
      name: '@storybook/addon-coverage',
      options: {
        istanbul: {
          include: ['**/stories/**'],
          exclude: ['**/exampleDirectory/**'],
        },
      },
    },
  ],
});
```

```ts filename=".storybook/main.ts" renderer="angular" language="ts" tabTitle="CSF Next 🧪"
import { defineMain } from '@storybook/angular/node';

// For Vite support add the following import
// import type { AddonOptionsVite } from '@storybook/addon-coverage';
import type { AddonOptionsWebpack } from '@storybook/addon-coverage';

const coverageConfig: AddonOptionsWebpack = {
  istanbul: {
    include: ['**/stories/**'],
    exclude: ['**/exampleDirectory/**'],
  },
};

export default defineMain({
  framework: '@storybook/angular',
  stories: [],
  addons: [
    // Other Storybook addons
    {
      name: '@storybook/addon-coverage',
      options: coverageConfig,
    },
  ],
});
```

```ts filename=".storybook/main.ts" renderer="web-components" language="ts" tabTitle="CSF Next 🧪"
import { defineMain } from '@storybook/web-components-vite/node';

import type { AddonOptionsVite } from '@storybook/addon-coverage';

const coverageConfig: AddonOptionsVite = {
  istanbul: {
    include: ['**/stories/**'],
    exclude: ['**/exampleDirectory/**'],
  },
};

export default defineMain({
  framework: '@storybook/web-components-vite',
  stories: [],
  addons: [
    // Other Storybook addons
    {
      name: '@storybook/addon-coverage',
      options: coverageConfig,
    },
  ],
});
```

<!-- JS snippets still needed while providing both CSF 3 & Next -->

```js filename=".storybook/main.js" renderer="web-components" language="js" tabTitle="CSF Next 🧪"
import { defineMain } from '@storybook/web-components-vite/node';

export default defineMain({
  framework: '@storybook/web-components-vite',
  stories: [],
  addons: [
    // Other Storybook addons
    {
      name: '@storybook/addon-coverage',
      options: {
        istanbul: {
          include: ['**/stories/**'],
          exclude: ['**/exampleDirectory/**'],
        },
      },
    },
  ],
});
```
