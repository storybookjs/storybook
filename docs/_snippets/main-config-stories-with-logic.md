```js filename=".storybook/main.js" renderer="common" language="js" tabTitle="CSF 3"
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

```ts filename=".storybook/main.ts" renderer="common" language="ts" tabTitle="CSF 3"
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

```ts filename=".storybook/main.ts" renderer="react" language="ts" tabTitle="CSF Next 🧪"
import type { StoriesEntry } from 'storybook/internal/types';

// Replace your-framework with the framework you are using (e.g., react-vite, nextjs, nextjs-vite)
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

<!-- JS snippets still needed while providing both CSF 3 & Next -->

```js filename=".storybook/main.js" renderer="react" language="js" tabTitle="CSF Next 🧪"
// Replace your-framework with the framework you are using (e.g., react-vite, nextjs, nextjs-vite)
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

```ts filename=".storybook/main.ts" renderer="vue" language="ts" tabTitle="CSF Next 🧪"
import { defineMain, type StoriesEntry } from '@storybook/vue3-vite/node';

async function findStories(): Promise<StoriesEntry[]> {
  // your custom logic returns a list of files
}

export default defineMain({
  framework: '@storybook/vue3-vite',
  stories: async (list: StoriesEntry[]) => [
    ...list,
    // 👇 Add your found stories to the existing list of story files
    ...(await findStories()),
  ],
});
```

```js filename=".storybook/main.js" renderer="vue" language="js" tabTitle="CSF Next 🧪"
import { defineMain } from '@storybook/vue3-vite/node';

async function findStories() {
  // your custom logic returns a list of files
}

export default defineMain({
  framework: '@storybook/vue3-vite',
  stories: async (list) => [
    ...list,
    // 👇 Add your found stories to the existing list of story files
    ...(await findStories()),
  ],
});
```

```ts filename=".storybook/main.ts" renderer="angular" language="ts" tabTitle="CSF Next 🧪"
import { defineMain } from '@storybook/angular/node';

async function findStories() {
  // your custom logic returns a list of files
}

export default defineMain({
  framework: '@storybook/angular',
  stories: async (list) => [
    ...list,
    // 👇 Add your found stories to the existing list of story files
    ...(await findStories()),
  ],
});
```

```ts filename=".storybook/main.ts" renderer="web-components" language="ts" tabTitle="CSF Next 🧪"
import { defineMain, type StoriesEntry } from '@storybook/web-components-vite/node';

async function findStories(): Promise<StoriesEntry[]> {
  // your custom logic returns a list of files
}

export default defineMain({
  framework: '@storybook/web-components-vite',
  stories: async (list: StoriesEntry[]) => [
    ...list,
    // 👇 Add your found stories to the existing list of story files
    ...(await findStories()),
  ],
});
```

<!-- JS snippets still needed while providing both CSF 3 & Next -->

```js filename=".storybook/main.js" renderer="web-components" language="js" tabTitle="CSF Next 🧪"
import { defineMain } from '@storybook/web-components-vite/node';

async function findStories() {
  // your custom logic returns a list of files
}

export default defineMain({
  framework: '@storybook/web-components-vite',
  stories: async (list) => [
    ...list,
    // 👇 Add your found stories to the existing list of story files
    ...(await findStories()),
  ],
});
```
