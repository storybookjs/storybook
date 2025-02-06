<!-- TOOD: VET this example for the webpack-based frameworks and adjust it for other frameworks -->

```js filename=".storybook/main.js" renderer="common" language="js" tabTitle="CSF 3"
export default {
  framework: {
    // Replace react-vite with the framework you are using (e.g., react-webpack5)
    name: '@storybook/react-vite',
    options: {
      legacyRootApi: true,
    },
  },
  stories: ['../src/**/*.mdx', '../src/**/*.stories.@(js|jsx|mjs|ts|tsx)'],
};
```

```js filename=".storybook/main.js" renderer="react" language="js" tabTitle="CSF Factory 🧪"
// Replace your-framework with the framework you are using (e.g., react-vite, nextjs, experimental-nextjs-vite)
import { defineMain } from '@storybook/react-vite/node';

export default defineMain({
  framework: {
    name: '@storybook/react-vite',
    options: {
      legacyRootApi: true,
    },
  },
  stories: ['../src/**/*.mdx', '../src/**/*.stories.@(js|jsx|mjs|ts|tsx)'],
});
```

```ts filename=".storybook/main.ts" renderer="common" language="ts" tabTitle="CSF 3"
// Replace react-vite with the framework you are using (e.g., react-webpack5)
import type { StorybookConfig } from '@storybook/react-vite';

const config: StorybookConfig = {
  framework: {
    name: '@storybook/react-vite',
    options: {
      legacyRootApi: true,
    },
  },
  stories: ['../src/**/*.mdx', '../src/**/*.stories.@(js|jsx|mjs|ts|tsx)'],
};

export default config;
```

```ts filename=".storybook/main.ts" renderer="react" language="ts" tabTitle="CSF Factory 🧪"
// Replace your-framework with the framework you are using (e.g., react-vite, nextjs, experimental-nextjs-vite)
import { defineMain } from '@storybook/react-vite/node';

export default defineMain({
  framework: {
    name: '@storybook/react-vite',
    options: {
      legacyRootApi: true,
    },
  },
  stories: ['../src/**/*.mdx', '../src/**/*.stories.@(js|jsx|mjs|ts|tsx)'],
});
```
