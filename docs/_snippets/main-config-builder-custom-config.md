```ts filename=".storybook/main.ts" renderer="common" language="ts" tabTitle="CSF (Legacy)"
// Replace your-framework with the framework you are using, e.g. react-vite, nextjs, vue3-vite, etc.
import type { StorybookConfig } from '@storybook/your-framework';

const config: StorybookConfig = {
  stories: ['../src/**/*.mdx', '../src/**/*.stories.@(js|jsx|mjs|ts|tsx)'],
  core: {
    builder: {
      name: '@storybook/builder-vite',
      options: {
        viteConfigPath: '../customVite.config.js',
      },
    },
  },
};

export default config;
```

```js filename=".storybook/main.js" renderer="common" language="js" tabTitle="CSF (Legacy)"
export default {
  stories: ['../src/**/*.mdx', '../src/**/*.stories.@(js|jsx|mjs|ts|tsx)'],
  core: {
    builder: {
      name: '@storybook/builder-vite',
      options: {
        viteConfigPath: '../customVite.config.js',
      },
    },
  },
};
```

```ts filename=".storybook/main.ts" renderer="react" language="ts" tabTitle="CSF"
// Replace your-framework with the framework you are using (e.g., react-vite, nextjs, nextjs-vite)
import { defineMain } from '@storybook/your-framework/node';

export default defineMain({
  stories: ['../src/**/*.mdx', '../src/**/*.stories.@(js|jsx|mjs|ts|tsx)'],
  core: {
    builder: {
      name: '@storybook/builder-vite',
      options: {
        viteConfigPath: '../customVite.config.js',
      },
    },
  },
});
```

<!-- JS snippets still needed while providing both CSF 3 & Next -->

```js filename=".storybook/main.js" renderer="react" language="js" tabTitle="CSF"
// Replace your-framework with the framework you are using (e.g., react-vite, nextjs, nextjs-vite)
import { defineMain } from '@storybook/your-framework/node';

export default defineMain({
  stories: ['../src/**/*.mdx', '../src/**/*.stories.@(js|jsx|mjs|ts|tsx)'],

  core: {
    builder: {
      name: '@storybook/builder-vite',
      options: {
        viteConfigPath: '../customVite.config.js',
      },
    },
  },
});
```

```ts filename=".storybook/main.ts" renderer="vue" language="ts" tabTitle="CSF"
import { defineMain } from '@storybook/vue3-vite/node';

export default defineMain({
  stories: ['../src/**/*.mdx', '../src/**/*.stories.@(js|jsx|mjs|ts|tsx)'],

  core: {
    builder: {
      name: '@storybook/builder-vite',
      options: {
        viteConfigPath: '../customVite.config.js',
      },
    },
  },
});
```

<!-- JS snippets still needed while providing both CSF 3 & Next -->

```js filename=".storybook/main.js" renderer="vue" language="js" tabTitle="CSF"
import { defineMain } from '@storybook/vue3-vite/node';

export default defineMain({
  stories: ['../src/**/*.mdx', '../src/**/*.stories.@(js|jsx|mjs|ts|tsx)'],

  core: {
    builder: {
      name: '@storybook/builder-vite',
      options: {
        viteConfigPath: '../customVite.config.js',
      },
    },
  },
});
```

```ts filename=".storybook/main.ts" renderer="web-components" language="ts" tabTitle="CSF"
import { defineMain } from '@storybook/web-components-vite/node';

export default defineMain({
  stories: ['../src/**/*.mdx', '../src/**/*.stories.@(js|jsx|mjs|ts|tsx)'],

  core: {
    builder: {
      name: '@storybook/builder-vite',
      options: {
        viteConfigPath: '../customVite.config.js',
      },
    },
  },
});
```

<!-- JS snippets still needed while providing both CSF 3 & Next -->

```js filename=".storybook/main.js" renderer="web-components" language="js" tabTitle="CSF"
import { defineMain } from '@storybook/web-components-vite/node';

export default defineMain({
  stories: ['../src/**/*.mdx', '../src/**/*.stories.@(js|jsx|mjs|ts|tsx)'],

  core: {
    builder: {
      name: '@storybook/builder-vite',
      options: {
        viteConfigPath: '../customVite.config.js',
      },
    },
  },
});
```
