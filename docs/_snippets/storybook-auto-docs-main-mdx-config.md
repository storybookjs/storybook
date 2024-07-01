```js filename=".storybook/main.js" renderer="common" language="js"
export default {
  // Replace your-framework with the framework you are using (e.g., react-webpack5, vue3-vite)
  framework: '@storybook/your-framework',
  stories: [
    //👇 Your documentation written in MDX along with your stories goes here
    '../src/**/*.mdx',
    '../src/**/*.stories.@(js|jsx|mjs|ts|tsx)',
  ],
  addons: ['@storybook/addon-essentials'],
};
```

```ts filename=".storybook/main.ts" renderer="common" language="ts"
// Replace your-framework with the framework you are using (e.g., react-webpack5, vue3-vite)
import type { StorybookConfig } from '@storybook/your-framework';

const config: StorybookConfig = {
  // Replace your-framework with the framework you are using (e.g., react-webpack5, vue3-vite)
  framework: '@storybook/your-framework',
  stories: [
    //👇 Your documentation written in MDX along with your stories goes here
    '../src/**/*.mdx',
    '../src/**/*.stories.@(js|jsx|mjs|ts|tsx)',
  ],
  addons: ['@storybook/addon-essentials'],
};

export default config;
```

