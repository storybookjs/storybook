<!-- TODO: Vet this example for CSF factory support-->

```js filename=".storybook/main.js" renderer="common" language="js" tabTitle="Vite (CSF 3)"
export default {
  // Replace your-framework with the framework you are using (e.g., react-vite, vue3-vite)
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

```js filename=".storybook/main.js" renderer="react" language="js" tabTitle="Vite (CSF Factory 🧪)"
// Replace your-framework with the framework you are using (e.g., react-vite, nextjs, experimental-nextjs-vite)
import { defineMain } from '@storybook/your-framework/node';

export default defineMain({
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
});
```

```ts filename=".storybook/main.ts" renderer="common" language="ts" tabTitle="Vite (CSF 3)"
// Replace your-framework with the framework you are using (e.g., react-vite, vue3-vite)
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

```ts filename=".storybook/main.ts" renderer="react" language="ts" tabTitle="Vite (CSF Factory 🧪)"
// Replace your-framework with the framework you are using (e.g., react-vite, nextjs, experimental-nextjs-vite)
import { defineMain } from '@storybook/your-framework/node';

export default defineMain({
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
});
```

```js filename=".storybook/main.js" renderer="common" language="js" tabTitle="Webpack (CSF 3)"
export default {
  // Replace your-framework with the framework you are using (e.g., nextjs, react-vite)
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

```js filename=".storybook/main.js" renderer="react" language="js" tabTitle="Webpack (CSF Factory 🧪)"
// Replace your-framework with the framework you are using (e.g., react-vite, nextjs, experimental-nextjs-vite)
import { defineMain } from '@storybook/your-framework/node';

export default defineMain({
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
});
```

```ts filename=".storybook/main.ts" renderer="common" language="ts" tabTitle="Webpack (CSF 3)"
// Replace your-framework with the framework you are using (e.g., nextjs, react-vite)
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

```ts filename=".storybook/main.ts" renderer="react" language="ts" tabTitle="Webpack (CSF Factory 🧪)"
// Replace your-framework with the framework you are using (e.g., react-vite, nextjs, experimental-nextjs-vite)
import { defineMain } from '@storybook/your-framework/node';

export default defineMain({
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
});
```
