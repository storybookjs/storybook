```js filename=".storybook/main.js" renderer="common" language="js"
export default {
  // Replace your-framework with the framework you are using, e.g. react-vite, nextjs, vue3-vite, etc.
  framework: '@storybook/your-framework',
  stories: ['../src/**/*.mdx', '../src/**/*.stories.@(js|jsx|mjs|ts|tsx)'],
  refs: {
    'design-system': {
      title: 'Storybook Design System',
      url: 'https://master--5ccbc373887ca40020446347.chromatic.com/',
      expanded: false, // Optional, true by default
      sourceUrl: 'https://github.com/storybookjs/storybook', // Optional
    },
  },
};
```

```ts filename=".storybook/main.ts" renderer="common" language="ts"
// Replace your-framework with the framework you are using, e.g. react-vite, nextjs, vue3-vite, etc.
import type { StorybookConfig } from '@storybook/your-framework';

const config: StorybookConfig = {
  framework: '@storybook/your-framework',
  stories: ['../src/**/*.mdx', '../src/**/*.stories.@(js|jsx|mjs|ts|tsx)'],
  refs: {
    'design-system': {
      title: 'Storybook Design System',
      url: 'https://master--5ccbc373887ca40020446347.chromatic.com/',
      expanded: false, // Optional, true by default,
      sourceUrl: 'https://github.com/storybookjs/storybook', // Optional
    },
  },
};

export default config;
```
