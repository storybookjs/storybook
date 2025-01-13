```js filename=".storybook/main.js" renderer="common" language="js" tabTitle="With Webpack"
export default {
  // Replace your-framework with the framework you are using (e.g., react-webpack5, nextjs, angular)
  framework: '@storybook/your-framework',
  stories: ['../src/**/*.mdx', '../stories/**/*.stories.@(js|jsx|mjs|ts|tsx)'],
  async webpackFinal(config) {
    config.module?.rules?.push({
      test: /\.(graphql|gql)$/,
      include: [path.resolve('./lib/emails')],
      exclude: /node_modules/,
      loader: 'graphql-tag/loader',
    });
    config.module?.rules?.push({
      test: /\.(graphql|gql)$/,
      include: [path.resolve('./lib/schema')],
      exclude: /node_modules/,
      loader: 'raw-loader',
    });

    return config;
  },
};
```

```js filename=".storybook/main.js" renderer="common" language="js" tabTitle="With Vite"
import graphql from 'vite-plugin-graphql-loader';

export default {
  // Replace your-framework with the framework you are using (e.g., react-vite, vue3-vite)
  framework: '@storybook/your-framework',
  stories: ['../src/**/*.mdx', '../stories/**/*.stories.@(js|jsx|mjs|ts|tsx)'],
  async viteFinal(config) {
    return {
      ...config,
      plugins: [...(config.plugins ?? []), graphql()],
    };
  },
};
```

```ts filename=".storybook/main.ts" renderer="common" language="ts" tabTitle="With Webpack"
// Replace your-framework with the framework you are using (e.g., react-webpack5, nextjs, angular)
import type { StorybookConfig } from '@storybook/your-framework';

const config: StorybookConfig = {
  framework: '@storybook/your-framework',
  stories: ['../src/**/*.mdx', '../stories/**/*.stories.@(js|jsx|mjs|ts|tsx)'],
  async webpackFinal(config) {
    config.module?.rules?.push({
      test: /\.(graphql|gql)$/,
      include: [path.resolve('./lib/emails')],
      exclude: /node_modules/,
      loader: 'graphql-tag/loader',
    });
    config.module?.rules?.push({
      test: /\.(graphql|gql)$/,
      include: [path.resolve('./lib/schema')],
      exclude: /node_modules/,
      loader: 'raw-loader',
    });

    return config;
  },
};

export default config;
```

```ts filename=".storybook/main.ts" renderer="common" language="ts" tabTitle="With Vite"
// Replace your-framework with the framework you are using (e.g., react-vite, vue3-vite)
import type { StorybookConfig } from '@storybook/your-framework';
import graphql from 'vite-plugin-graphql-loader';

const config: StorybookConfig = {
  framework: '@storybook/your-framework',
  stories: ['../src/**/*.mdx', '../stories/**/*.stories.@(js|jsx|mjs|ts|tsx)'],
  async viteFinal(config) {
    return {
      ...config,
      plugins: [...(config.plugins ?? []), graphql()],
    };
  },
};

export default config;
```
