```js filename=".storybook/main.ts" renderer="common" language="js" tabTitle="CSF 3"
const combosIndexer = {
  test: /\.stories\.[tj]sx?$/,
  createIndex: async (fileName, { makeTitle }) => {
    // 👇 Grab title from fileName
    const title = fileName.match(/\/(.*)\.stories/)[1];

    // Read file and generate entries ...
    let entries = [];
    // Read file and generate entries...

    return entries.map((entry) => ({
      type: 'story',
      // 👇 Use makeTitle to format the title
      title: `${makeTitle(title)} Custom`,
      importPath: fileName,
      exportName: entry.name,
    }));
  },
};

const config = {
  framework: '@storybook/your-framework',
  stories: ['../src/**/*.mdx', '../src/**/*.stories.@(js|jsx|ts|tsx)'],
  experimental_indexers: async (existingIndexers) => [...existingIndexers, combosIndexer],
};

export default config;
```

```ts filename=".storybook/main.ts" renderer="common" language="ts" tabTitle="CSF 3"
// Replace your-framework with the framework you are using, e.g. react-vite, nextjs, vue3-vite, etc.
import type { StorybookConfig } from '@storybook/your-framework';
import type { Indexer } from 'storybook/internal/types';

const combosIndexer: Indexer = {
  test: /\.stories\.[tj]sx?$/,
  createIndex: async (fileName, { makeTitle }) => {
    // 👇 Grab title from fileName
    const title = fileName.match(/\/(.*)\.stories/)[1];

    // Read file and generate entries ...
    const entries = [];

    return entries.map((entry) => ({
      type: 'story',
      // 👇 Use makeTitle to format the title
      title: `${makeTitle(title)} Custom`,
      importPath: fileName,
      exportName: entry.name,
    }));
  },
};

const config: StorybookConfig = {
  framework: '@storybook/your-framework',
  stories: ['../src/**/*.mdx', '../src/**/*.stories.@(js|jsx|ts|tsx)'],
  experimental_indexers: async (existingIndexers) => [...existingIndexers, combosIndexer],
};

export default config;
```

```ts filename=".storybook/main.ts" renderer="react" language="ts" tabTitle="CSF Next 🧪"
import type { Indexer } from 'storybook/internal/types';

// Replace your-framework with the framework you are using (e.g., react-vite, nextjs, nextjs-vite)
import { defineMain } from '@storybook/your-framework/node';

const combosIndexer: Indexer = {
  test: /\.stories\.[tj]sx?$/,
  createIndex: async (fileName, { makeTitle }) => {
    // 👇 Grab title from fileName
    const title = fileName.match(/\/(.*)\.stories/)[1];

    // Read file and generate entries ...
    const entries = [];

    return entries.map((entry) => ({
      type: 'story',
      // 👇 Use makeTitle to format the title
      title: `${makeTitle(title)} Custom`,
      importPath: fileName,
      exportName: entry.name,
    }));
  },
};

export default defineMain({
  framework: '@storybook/your-framework',
  stories: ['../src/**/*.mdx', '../src/**/*.stories.@(js|jsx|ts|tsx)'],
  experimental_indexers: async (existingIndexers) => [...existingIndexers, combosIndexer],
});
```

<!-- JS snippets still needed while providing both CSF 3 & Next -->

```js filename=".storybook/main.ts" renderer="react" language="js" tabTitle="CSF Next 🧪"
// Replace your-framework with the framework you are using (e.g., react-vite, nextjs, nextjs-vite)
import { defineMain } from '@storybook/your-framework/node';

const combosIndexer = {
  test: /\.stories\.[tj]sx?$/,
  createIndex: async (fileName, { makeTitle }) => {
    // 👇 Grab title from fileName
    const title = fileName.match(/\/(.*)\.stories/)[1];

    // Read file and generate entries ...
    let entries = [];
    // Read file and generate entries...

    return entries.map((entry) => ({
      type: 'story',
      // 👇 Use makeTitle to format the title
      title: `${makeTitle(title)} Custom`,
      importPath: fileName,
      exportName: entry.name,
    }));
  },
};

export default defineMain({
  framework: '@storybook/your-framework',
  stories: ['../src/**/*.mdx', '../src/**/*.stories.@(js|jsx|ts|tsx)'],
  experimental_indexers: async (existingIndexers) => [...existingIndexers, combosIndexer],
});
```
