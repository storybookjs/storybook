```js filename=".storybook/main.js" renderer="common" language="js"
export default {
  // Replace your-framework with the framework you are using, e.g. react-vite, nextjs, vue3-vite, etc.
  framework: '@storybook/your-framework',
  stories: ['../src/**/*.mdx', '../src/**/*.stories.@(js|jsx|mjs|ts|tsx)'],
  previewHead: (head) => `
    ${head}
    ${
      process.env.ANALYTICS_ID ? '<script src="https://cdn.example.com/analytics.js"></script>' : ''
    }
  `,
};
```

```ts filename=".storybook/main.ts" renderer="common" language="ts"
// Replace your-framework with the framework you are using, e.g. react-vite, nextjs, vue3-vite, etc.
import type { StorybookConfig } from '@storybook/your-framework';

const config: StorybookConfig = {
  framework: '@storybook/your-framework',
  stories: ['../src/**/*.mdx', '../src/**/*.stories.@(js|jsx|mjs|ts|tsx)'],
  previewHead: (head) => `
    ${head}
    ${
      process.env.ANALYTICS_ID ? '<script src="https://cdn.example.com/analytics.js"></script>' : ''
    }
  `,
};

export default config;
```
