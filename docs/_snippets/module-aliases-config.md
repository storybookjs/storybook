```js filename=".storybook/main.js" renderer="common" language="js" tabTitle="vite"
export default {
  // Replace your-framework with the framework you are using (e.g., react-webpack5, vue3-vite)
  framework: '@storybook/your-framework',
  stories: ['../src/**/*.mdx', '../src/**/*.stories.@(js|jsx|mjs|ts|tsx)'],
  viteFinal: async (config) => {
    if (config.resolve) {
      config.resolve.alias = {
        ...config.resolve?.alias,
        // 👇 External module
        lodash: require.resolve('./lodash.mock'),
        // 👇 Internal modules
        '@/api': path.resolve(__dirname, './api.mock.ts'),
        '@/app/actions': path.resolve(__dirname, './app/actions.mock.ts'),
        '@/lib/session': path.resolve(__dirname, './lib/session.mock.ts'),
        '@/lib/db': path.resolve(__dirname, './lib/db.mock.ts'),
      };
    }

    return config;
  },
};
```

```ts filename=".storybook/main.ts" renderer="common" language="ts" tabTitle="vite"
// Replace your-framework with the framework you are using (e.g., react-webpack5, vue3-vite)
import type { StorybookConfig } from '@storybook/your-framework';

const config: StorybookConfig = {
  framework: '@storybook/your-framework',
  stories: ['../src/**/*.mdx', '../src/**/*.stories.@(js|jsx|mjs|ts|tsx)'],
  viteFinal: async (config) => {
    if (config.resolve) {
      config.resolve.alias = {
        ...config.resolve?.alias,
        // 👇 External module
        lodash: require.resolve('./lodash.mock'),
        // 👇 Internal modules
        '@/api': path.resolve(__dirname, './api.mock.ts'),
        '@/app/actions': path.resolve(__dirname, './app/actions.mock.ts'),
        '@/lib/session': path.resolve(__dirname, './lib/session.mock.ts'),
        '@/lib/db': path.resolve(__dirname, './lib/db.mock.ts'),
      };
    }

    return config;
  },
};

export default config;
```

```js filename=".storybook/main.js" renderer="common" language="js" tabTitle="webpack"
export default {
  // Replace your-framework with the framework you are using (e.g., nextjs, vue3-vite)
  framework: '@storybook/your-framework',
  stories: ['../src/**/*.mdx', '../src/**/*.stories.@(js|jsx|mjs|ts|tsx)'],
  webpackFinal: async (config) => {
    if (config.resolve) {
      config.resolve.alias = {
        ...config.resolve.alias,
        // 👇 External module
        lodash: require.resolve('./lodash.mock'),
        // 👇 Internal modules
        '@/api$': path.resolve(__dirname, './api.mock.ts'),
        '@/app/actions$': path.resolve(__dirname, './app/actions.mock.ts'),
        '@/lib/session$': path.resolve(__dirname, './lib/session.mock.ts'),
        '@/lib/db$': path.resolve(__dirname, './lib/db.mock.ts'),
      };
    }

    return config;
  },
};
```

```ts filename=".storybook/main.ts" renderer="common" language="ts" tabTitle="webpack"
// Replace your-framework with the framework you are using (e.g., nextjs, vue3-vite)
import type { StorybookConfig } from '@storybook/your-framework';

const config: StorybookConfig = {
  framework: '@storybook/your-framework',
  stories: ['../src/**/*.mdx', '../src/**/*.stories.@(js|jsx|mjs|ts|tsx)'],
  webpackFinal: async (config) => {
    if (config.resolve) {
      config.resolve.alias = {
        ...config.resolve.alias,
        // 👇 External module
        lodash: require.resolve('./lodash.mock'),
        // 👇 Internal modules
        '@/api$': path.resolve(__dirname, './api.mock.ts'),
        '@/app/actions$': path.resolve(__dirname, './app/actions.mock.ts'),
        '@/lib/session$': path.resolve(__dirname, './lib/session.mock.ts'),
        '@/lib/db$': path.resolve(__dirname, './lib/db.mock.ts'),
      };
    }

    return config;
  },
};

export default config;
```

