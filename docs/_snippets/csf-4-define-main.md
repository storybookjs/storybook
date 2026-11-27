```ts filename=".storybook/main.js|ts" renderer="common" language="ts"
// Replace your-framework with the framework you are using (e.g., nextjs-vite, sveltekit, etc.)
import { defineMain } from '@storybook/your-framework/node';

export default defineMain({
  framework: '@storybook/your-framework',
  stories: ['../src/**/*.mdx', '../src/**/*.stories.@(js|jsx|mjs|ts|tsx)'],
  addons: ['@storybook/addon-a11y'],
});
```
