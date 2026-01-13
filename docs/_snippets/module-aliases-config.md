```js filename=".storybook/main.js" renderer="common" language="js" tabTitle="Vite (CSF 3)"
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

```ts filename=".storybook/main.ts" renderer="common" language="ts" tabTitle="Vite (CSF 3)"
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

```js filename=".storybook/main.js" renderer="common" language="js" tabTitle="Webpack (CSF 3)"
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

```ts filename=".storybook/main.ts" renderer="common" language="ts" tabTitle="Webpack (CSF 3)"
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

```ts filename=".storybook/main.ts" renderer="react" language="ts" tabTitle="Vite (CSF Next 🧪)"
// Replace your-framework with the framework you are using (e.g., react-vite, nextjs-vite)
import { defineMain } from '@storybook/your-framework/node';

export default defineMain({
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
});
```

<!-- JS snippets still needed while providing both CSF 3 & Next -->

```js filename=".storybook/main.js" renderer="react" language="js" tabTitle="Vite (CSF Next 🧪)"
// Replace your-framework with the framework you are using (e.g., react-vite, nextjs-vite)
import { defineMain } from '@storybook/your-framework/node';

export default defineMain({
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
});
```

```ts filename=".storybook/main.ts" renderer="react" language="ts" tabTitle="Webpack (CSF Next 🧪)"
// Replace your-framework with the framework you are using (e.g., nextjs, react-webpack5)
import { defineMain } from '@storybook/your-framework/node';

export default defineMain({
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
});
```

<!-- JS snippets still needed while providing both CSF 3 & Next -->

```js filename=".storybook/main.js" renderer="react" language="js" tabTitle="Webpack (CSF Next 🧪)"
// Replace your-framework with the framework you are using (e.g., nextjs, react-webpack5)
import { defineMain } from '@storybook/your-framework/node';

export default defineMain({
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
});
```

```ts filename=".storybook/main.ts" renderer="vue" language="ts" tabTitle="Vite (CSF Next 🧪)"
import { defineMain } from '@storybook/vue3-vite/node';

export default defineMain({
  framework: '@storybook/vue3-vite',
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
});
```

<!-- JS snippets still needed while providing both CSF 3 & Next -->

```js filename=".storybook/main.js" renderer="vue" language="js" tabTitle="Vite (CSF Next 🧪)"
import { defineMain } from '@storybook/vue3-vite/node';

export default defineMain({
  framework: '@storybook/vue3-vite',
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
});
```

```ts filename=".storybook/main.ts" renderer="angular" language="ts" tabTitle="Webpack (CSF Next 🧪)"
import { defineMain } from '@storybook/angular/node';

export default defineMain({
  framework: '@storybook/angular',
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
});
```

<!-- JS snippets still needed while providing both CSF 3 & Next -->

```js filename=".storybook/main.js" renderer="angular" language="js" tabTitle="Webpack (CSF Next 🧪)"
import { defineMain } from '@storybook/angular/node';

export default defineMain({
  framework: '@storybook/angular',
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
});
```
