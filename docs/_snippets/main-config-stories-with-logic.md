```js filename=".storybook/main.js" renderer="common" language="js" tabTitle="CSF 3"
async function findStories() {
  // your custom logic returns a list of files
}

export default {
  // Replace your-framework with the framework you are using (e.g., react-vite, vue3-vite)
  framework: '@storybook/your-framework',
  stories: async (list) => [
    ...list,
    // 👇 Add your found stories to the existing list of story files
    ...(await findStories()),
  ],
};
```

```js filename=".storybook/main.js" renderer="react" language="js" tabTitle="CSF Factory 🧪"
// Replace your-framework with the framework you are using (e.g., react-vite, nextjs, experimental-nextjs-vite)
import { defineMain } from '@storybook/your-framework/node';

async function findStories() {
  // your custom logic returns a list of files
}

export default defineMain({
  framework: '@storybook/your-framework',
  stories: async (list) => [
    ...list,
    // 👇 Add your found stories to the existing list of story files
    ...(await findStories()),
  ],
});
```

```ts filename=".storybook/main.ts" renderer="common" language="ts" tabTitle="CSF 3"
// Replace your-framework with the framework you are using (e.g., react-vite, vue3-vite)
import type { StorybookConfig } from '@storybook/your-framework';
import type { StoriesEntry } from '@storybook/types';

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

```ts filename=".storybook/main.ts" renderer="react" language="ts" tabTitle="CSF Factory 🧪"
// Replace your-framework with the framework you are using (e.g., react-vite, nextjs, experimental-nextjs-vite)
import type { StoriesEntry } from '@storybook/types';

import { defineMain } from '@storybook/your-framework/node';

async function findStories(): Promise<StoriesEntry[]> {
  // your custom logic returns a list of files
}

export default defineMain({
  framework: '@storybook/your-framework',
  stories: async (list: StoriesEntry[]) => [
    ...list,
    // 👇 Add your found stories to the existing list of story files
    ...(await findStories()),
  ],
});
```
