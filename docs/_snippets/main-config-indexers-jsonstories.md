```js filename=".storybook/main.js" renderer="common" language="js" tabTitle="CSF 3"
import fs from 'fs/promises';

const jsonStoriesIndexer = {
  test: /stories\.json$/,
  createIndex: async (fileName) => {
    const content = JSON.parse(fs.readFileSync(fileName));

    const stories = generateStoryIndexesFromJson(content);

    return stories.map((story) => ({
      type: 'story',
      importPath: `virtual:jsonstories--${fileName}--${story.componentName}`,
      exportName: story.name,
    }));
  },
};

const config = {
  framework: '@storybook/your-framework',
  stories: [
    '../src/**/*.mdx',
    '../src/**/*.stories.@(js|jsx|mjs|ts|tsx)',
    // 👇 Make sure files to index are included in `stories`
    '../src/**/*.stories.json',
  ],
  experimental_indexers: async (existingIndexers) => [...existingIndexers, jsonStoriesIndexer],
};

export default config;
```

```ts filename=".storybook/main.ts" renderer="common" language="ts" tabTitle="CSF 3"
import type { Indexer } from 'storybook/internal/types';
// Replace your-framework with the framework you are using, e.g. react-vite, nextjs, vue3-vite, etc.
import type { StorybookConfig } from '@storybook/your-framework';

import fs from 'fs/promises';

const jsonStoriesIndexer: Indexer = {
  test: /stories\.json$/,
  createIndex: async (fileName) => {
    const content = JSON.parse(fs.readFileSync(fileName));

    const stories = generateStoryIndexesFromJson(content);

    return stories.map((story) => ({
      type: 'story',
      importPath: `virtual:jsonstories--${fileName}--${story.componentName}`,
      exportName: story.name,
    }));
  },
};

const config: StorybookConfig = {
  framework: '@storybook/your-framework',
  stories: [
    '../src/**/*.mdx',
    '../src/**/*.stories.@(js|jsx|mjs|ts|tsx)',
    // 👇 Make sure files to index are included in `stories`
    '../src/**/*.stories.json',
  ],
  experimental_indexers: async (existingIndexers) => [...existingIndexers, jsonStoriesIndexer],
};

export default config;
```

```ts filename=".storybook/main.ts" renderer="react" language="ts" tabTitle="CSF Next 🧪"
import type { Indexer } from 'storybook/internal/types';
// Replace your-framework with the framework you are using (e.g., react-vite, nextjs, nextjs-vite)
import { defineMain } from '@storybook/your-framework/node';

import fs from 'fs/promises';

const jsonStoriesIndexer: Indexer = {
  test: /stories\.json$/,
  createIndex: async (fileName) => {
    const content = JSON.parse(fs.readFileSync(fileName));

    const stories = generateStoryIndexesFromJson(content);

    return stories.map((story) => ({
      type: 'story',
      importPath: `virtual:jsonstories--${fileName}--${story.componentName}`,
      exportName: story.name,
    }));
  },
};

export default defineMain({
  framework: '@storybook/your-framework',
  stories: [
    '../src/**/*.mdx',
    '../src/**/*.stories.@(js|jsx|mjs|ts|tsx)',
    // 👇 Make sure files to index are included in `stories`
    '../src/**/*.stories.json',
  ],
  experimental_indexers: async (existingIndexers) => [...existingIndexers, jsonStoriesIndexer],
});
```

<!-- JS snippets still needed while providing both CSF 3 & Next -->

```js filename=".storybook/main.js" renderer="react" language="js" tabTitle="CSF Next 🧪"
// Replace your-framework with the framework you are using (e.g., react-vite, nextjs, nextjs-vite)
import { defineMain } from '@storybook/your-framework/node';

import fs from 'fs/promises';

const jsonStoriesIndexer = {
  test: /stories\.json$/,
  createIndex: async (fileName) => {
    const content = JSON.parse(fs.readFileSync(fileName));

    const stories = generateStoryIndexesFromJson(content);

    return stories.map((story) => ({
      type: 'story',
      importPath: `virtual:jsonstories--${fileName}--${story.componentName}`,
      exportName: story.name,
    }));
  },
};

export default defineMain({
  framework: '@storybook/your-framework',
  stories: [
    '../src/**/*.mdx',
    '../src/**/*.stories.@(js|jsx|mjs|ts|tsx)',
    // 👇 Make sure files to index are included in `stories`
    '../src/**/*.stories.json',
  ],
  experimental_indexers: async (existingIndexers) => [...existingIndexers, jsonStoriesIndexer],
});
```
