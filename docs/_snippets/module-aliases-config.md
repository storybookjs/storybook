```js filename=".storybook/main.js" renderer="common" language="js" tabTitle="vite"
export default {
  // Replace your-framework with the framework you are using, e.g. react-vite, nextjs-vite, vue3-vite, etc.
  framework: '@storybook/your-framework',
  stories: ['../src/**/*.mdx', '../src/**/*.stories.@(js|jsx|mjs|ts|tsx)'],
  viteFinal: async (config) => {
    if (config.resolve) {
      config.resolve.alias = {
        ...config.resolve?.alias,
        // 👇 External module
        lodash: import.meta.resolve('./lodash.mock'),
        // 👇 Internal modules
        '@/api': import.meta.resolve('./api.mock.ts'),
        '@/app/actions': import.meta.resolve('./app/actions.mock.ts'),
        '@/lib/session': import.meta.resolve('./lib/session.mock.ts'),
        '@/lib/db': import.meta.resolve('./lib/db.mock.ts'),
      };
    }

    return config;
  },
};
```

```ts filename=".storybook/main.ts" renderer="common" language="ts" tabTitle="vite"
// Replace your-framework with the framework you are using, e.g. react-vite, nextjs-vite, vue3-vite, etc.
import type { StorybookConfig } from '@storybook/your-framework';

const config: StorybookConfig = {
  framework: '@storybook/your-framework',
  stories: ['../src/**/*.mdx', '../src/**/*.stories.@(js|jsx|mjs|ts|tsx)'],
  viteFinal: async (config) => {
    if (config.resolve) {
      config.resolve.alias = {
        ...config.resolve?.alias,
        // 👇 External module
        lodash: import.meta.resolve('./lodash.mock'),
        // 👇 Internal modules
        '@/api': import.meta.resolve('./api.mock.ts'),
        '@/app/actions': import.meta.resolve('./app/actions.mock.ts'),
        '@/lib/session': import.meta.resolve('./lib/session.mock.ts'),
        '@/lib/db': import.meta.resolve('./lib/db.mock.ts'),
      };
    }

    return config;
  },
};

export default config;
```

```js filename=".storybook/main.js" renderer="common" language="js" tabTitle="webpack"
export default {
  // Replace your-framework with the framework you are using (e.g., nextjs, react-webpack5)
  framework: '@storybook/your-framework',
  stories: ['../src/**/*.mdx', '../src/**/*.stories.@(js|jsx|mjs|ts|tsx)'],
  webpackFinal: async (config) => {
    if (config.resolve) {
      config.resolve.alias = {
        ...config.resolve.alias,
        // 👇 External module
        lodash: import.meta.resolve('./lodash.mock'),
        // 👇 Internal modules
        '@/api$': import.meta.resolve('./api.mock.ts'),
        '@/app/actions$': import.meta.resolve('./app/actions.mock.ts'),
        '@/lib/session$': import.meta.resolve('./lib/session.mock.ts'),
        '@/lib/db$': import.meta.resolve('./lib/db.mock.ts'),
      };
    }

    return config;
  },
};
```

```ts filename=".storybook/main.ts" renderer="common" language="ts" tabTitle="webpack"
// Replace your-framework with the framework you are using (e.g., nextjs, react-webpack5)
import type { StorybookConfig } from '@storybook/your-framework';

const config: StorybookConfig = {
  framework: '@storybook/your-framework',
  stories: ['../src/**/*.mdx', '../src/**/*.stories.@(js|jsx|mjs|ts|tsx)'],
  webpackFinal: async (config) => {
    if (config.resolve) {
      config.resolve.alias = {
        ...config.resolve.alias,
        // 👇 External module
        lodash: import.meta.resolve('./lodash.mock'),
        // 👇 Internal modules
        '@/api$': import.meta.resolve('./api.mock.ts'),
        '@/app/actions$': import.meta.resolve('./app/actions.mock.ts'),
        '@/lib/session$': import.meta.resolve('./lib/session.mock.ts'),
        '@/lib/db$': import.meta.resolve('./lib/db.mock.ts'),
      };
    }

    return config;
  },
};

export default config;
```
