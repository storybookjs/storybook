```ts filename=".storybook/main.js|ts (CSF Next 🧪)" renderer="react" language="ts"
// Replace your-framework with the framework you are using (e.g., react-vite, nextjs, nextjs-vite)
import { defineMain } from '@storybook/your-framework/node';

export default defineMain({
  framework: '@storybook/your-framework',
  stories: ['../src/**/*.mdx', '../src/**/*.stories.@(js|jsx|mjs|ts|tsx)'],
  features: {
    experimentalTestSyntax: true,
  },
});
```

```ts filename=".storybook/main.js|ts (CSF Next 🧪)" renderer="vue" language="ts"
import { defineMain } from '@storybook/vue3-vite/node';

export default defineMain({
  framework: '@storybook/vue3-vite',
  stories: ['../src/**/*.mdx', '../src/**/*.stories.@(js|jsx|mjs|ts|tsx)'],
  features: {
    experimentalTestSyntax: true,
  },
});
```
