```js filename=".storybook/main.js" renderer="common" language="js"
async function findStories() {
  // your custom logic returns a list of files
}

export default {
  // Replace your-framework with the framework you are using, e.g. react-vite, nextjs, vue3-vite, etc.
  framework: '@storybook/your-framework',
  stories: async (list) => [
    ...list,
    // 👇 Add your found stories to the existing list of story files
    ...(await findStories()),
  ],
};
```

```ts filename=".storybook/main.ts" renderer="common" language="ts"
// Replace your-framework with the framework you are using, e.g. react-vite, nextjs, vue3-vite, etc.
import type { StorybookConfig } from '@storybook/your-framework';
import type { StoriesEntry } from 'storybook/internal/types';

async function findStories(): Promise<StoriesEntry[]> {
  // your custom logic returns a list of files
}

const config: StorybookConfig = {
  framework: '@storybook/your-framework',
  stories: async (list: StoriesEntry[]) => [
    ...list,
    // 👇 Add your found stories to the existing list of story files
    ...(await findStories()),
  ],
};

export default config;
```
