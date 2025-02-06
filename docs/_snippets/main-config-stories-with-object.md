```js filename=".storybook/main.js" renderer="common" language="js" tabTitle="CSF 3"
export default {
  // Replace your-framework with the framework you are using (e.g., react-vite, vue3-vite)
  framework: '@storybook/your-framework',
  stories: [
    {
      // 👇 Sets the directory containing your stories
      directory: '../packages/components',
      // 👇 Storybook will load all files that match this glob
      files: '*.stories.*',
      // 👇 Used when generating automatic titles for your stories
      titlePrefix: 'MyComponents',
    },
  ],
};
```

```js filename=".storybook/main.js" renderer="react" language="js" tabTitle="CSF Factory 🧪"
// Replace your-framework with the framework you are using (e.g., react-vite, nextjs, experimental-nextjs-vite)
import { defineMain } from '@storybook/your-framework/node';

export default defineMain({
  framework: '@storybook/your-framework',
  stories: [
    {
      // 👇 Sets the directory containing your stories
      directory: '../packages/components',
      // 👇 Storybook will load all files that match this glob
      files: '*.stories.*',
      // 👇 Used when generating automatic titles for your stories
      titlePrefix: 'MyComponents',
    },
  ],
});
```

```ts filename=".storybook/main.ts" renderer="common" language="ts" tabTitle="CSF 3"
// Replace your-framework with the framework you are using (e.g., react-vite, vue3-vite)
import type { StorybookConfig } from '@storybook/your-framework';

const config: StorybookConfig = {
  framework: '@storybook/your-framework',
  stories: [
    {
      // 👇 Sets the directory containing your stories
      directory: '../packages/components',
      // 👇 Storybook will load all files that match this glob
      files: '*.stories.*',
      // 👇 Used when generating automatic titles for your stories
      titlePrefix: 'MyComponents',
    },
  ],
};

export default config;
```

```ts filename=".storybook/main.ts" renderer="react" language="ts" tabTitle="CSF Factory 🧪"
// Replace your-framework with the framework you are using (e.g., react-vite, nextjs, experimental-nextjs-vite)
import { defineMain } from '@storybook/your-framework/node';

export default defineMain({
  framework: '@storybook/your-framework',
  stories: [
    {
      // 👇 Sets the directory containing your stories
      directory: '../packages/components',
      // 👇 Storybook will load all files that match this glob
      files: '*.stories.*',
      // 👇 Used when generating automatic titles for your stories
      titlePrefix: 'MyComponents',
    },
  ],
});
```
