```ts filename=".storybook/main.ts" renderer="react" language="ts" tabTitle="CSF 3"
// Replace your-framework with the framework you are using, e.g. react-vite, nextjs, nextjs-vite, etc.
import type { StorybookConfig } from '@storybook/your-framework';

const config: StorybookConfig = {
  framework: '@storybook/your-framework',
  stories: ['../src/**/*.mdx', '../src/**/*.stories.@(js|jsx|mjs|ts|tsx)'],
  typescript: {
    reactDocgen: 'react-docgen-typescript',
    reactDocgenTypescriptOptions: {
      // 👇 Add your workspace package source files so they're included in the TS program
      include: ['**/*.tsx', '../../packages/ui/src/**/*.tsx'],
    },
  },
};

export default config;
```

```ts filename=".storybook/main.ts" renderer="react" language="ts" tabTitle="CSF Next 🧪"
// Replace your-framework with the framework you are using (e.g., react-vite, nextjs, nextjs-vite)
import { defineMain } from '@storybook/your-framework/node';

export default defineMain({
  framework: '@storybook/your-framework',
  stories: ['../src/**/*.mdx', '../src/**/*.stories.@(js|jsx|mjs|ts|tsx)'],
  typescript: {
    reactDocgen: 'react-docgen-typescript',
    reactDocgenTypescriptOptions: {
      // 👇 Add your workspace package source files so they're included in the TS program
      include: ['**/*.tsx', '../../packages/ui/src/**/*.tsx'],
    },
  },
});
```
```ts filename=".storybook/main.ts" renderer="solid" language="ts" tabTitle="CSF 3"
import type { StorybookConfig } from 'storybook-solidjs-vite';

const config: StorybookConfig = {
  framework: 'storybook-solidjs-vite',
  stories: ['../src/**/*.mdx', '../src/**/*.stories.@(js|jsx|mjs|ts|tsx)'],
  typescript: {
    reactDocgen: 'react-docgen-typescript',
    reactDocgenTypescriptOptions: {
      // 👇 Add your workspace package source files so they're included in the TS program
      include: ['**/*.tsx', '../../packages/ui/src/**/*.tsx'],
    },
  },
};

export default config;
```

```ts filename=".storybook/main.ts" renderer="solid" language="ts" tabTitle="CSF Next 🧪"
import { defineMain } from 'storybook-solidjs-vite';

export default defineMain({
  framework: { name: 'storybook-solidjs-vite' },
  stories: ['../src/**/*.mdx', '../src/**/*.stories.@(js|jsx|mjs|ts|tsx)'],
  typescript: {
    reactDocgen: 'react-docgen-typescript',
    reactDocgenTypescriptOptions: {
      // 👇 Add your workspace package source files so they're included in the TS program
      include: ['**/*.tsx', '../../packages/ui/src/**/*.tsx'],
    },
  },
});
```
