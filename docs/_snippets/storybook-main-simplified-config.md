```js filename=".storybook/main.js" renderer="common" language="js" tabTitle="CSF (Legacy)"
export default {
  // Replace your-framework with the framework you are using, e.g. react-webpack5, nextjs, angular, etc.
  framework: '@storybook/your-framework',
  stories: ['../src/**/*.mdx', '../src/**/*.stories.@(js|jsx|mjs|ts|tsx)'],
  webpackFinal: async (config) => {
    config.plugins.push(/* ... */);
    return config;
  },
};
```

```ts filename=".storybook/main.ts" renderer="common" language="ts" tabTitle="CSF (Legacy)"
// Replace your-framework with the framework you are using, e.g. react-webpack5, nextjs, angular, etc.
import type { StorybookConfig } from '@storybook/your-framework';

const config: StorybookConfig = {
  framework: '@storybook/your-framework',
  stories: ['../src/**/*.mdx', '../src/**/*.stories.@(js|jsx|mjs|ts|tsx)'],
  webpackFinal: async (config) => {
    config.plugins.push(/* ... */);
    return config;
  },
};

export default config;
```

```ts filename=".storybook/main.ts" renderer="react" language="ts" tabTitle="CSF"
// Replace your-framework with the framework you are using, e.g. react-webpack5, nextjs, etc.
import { defineMain } from '@storybook/your-framework/node';

export default defineMain({
  framework: '@storybook/your-framework',
  stories: ['../src/**/*.mdx', '../src/**/*.stories.@(js|jsx|mjs|ts|tsx)'],
  webpackFinal: async (config) => {
    config.plugins.push(/* ... */);
    return config;
  },
});
```

<!-- JS snippets still needed while providing both CSF 3 & Next -->

```js filename=".storybook/main.js" renderer="react" language="js" tabTitle="CSF"
// Replace your-framework with the framework you are using, e.g. react-webpack5, nextjs, etc.
import { defineMain } from '@storybook/your-framework/node';

export default defineMain({
  framework: '@storybook/your-framework',
  stories: ['../src/**/*.mdx', '../src/**/*.stories.@(js|jsx|mjs|ts|tsx)'],
  webpackFinal: async (config) => {
    config.plugins.push(/* ... */);
    return config;
  },
});
```

```ts filename=".storybook/main.ts" renderer="angular" language="ts" tabTitle="CSF"
import { defineMain } from '@storybook/angular/node';

export default defineMain({
  framework: '@storybook/angular',
  stories: ['../src/**/*.mdx', '../src/**/*.stories.@(js|jsx|mjs|ts|tsx)'],
  webpackFinal: async (config) => {
    config.plugins.push(/* ... */);
    return config;
  },
});
```
