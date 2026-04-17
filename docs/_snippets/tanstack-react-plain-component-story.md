```js filename="Page.stories.js" renderer="react" language="js" tabTitle="CSF 3"
import { Page } from './Page';

export default {
  title: 'Example/Page',
  component: Page,
};

export const Default = {
  parameters: {
    tanstack: {
      router: {
        route: {
          path: '/demo/form/address',
        },
        query: { view: 'list' },
        routeOverrides: {
          '/demo/form/address': {
            loader: async () => ({
              featuredItems: [
                { name: 'Item A', description: 'First featured item' },
                { name: 'Item B', description: 'Second featured item' },
              ],
            }),
          },
        },
      },
    },
  },
};
```

```ts filename="Page.stories.ts" renderer="react" language="ts" tabTitle="CSF 3"
import type { Meta, StoryObj } from '@storybook/tanstack-react';

import { Page } from './Page';

const meta = {
  title: 'Example/Page',
  component: Page,
} satisfies Meta<typeof Page>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  parameters: {
    tanstack: {
      router: {
        route: {
          path: '/demo/form/address',
        },
        query: { view: 'list' },
        routeOverrides: {
          '/demo/form/address': {
            loader: async () => ({
              featuredItems: [
                { name: 'Item A', description: 'First featured item' },
                { name: 'Item B', description: 'Second featured item' },
              ],
            }),
          },
        },
      },
    },
  },
};
```

```ts filename="Page.stories.ts" renderer="react" language="ts" tabTitle="CSF Next 🧪"
import preview from '../.storybook/preview';

import { Page } from './Page';

const meta = preview.meta({
  title: 'Example/Page',
  component: Page,
});

export default meta;

export const Default = meta.story({
  parameters: {
    tanstack: {
      router: {
        route: {
          path: '/demo/form/address',
        },
        query: { view: 'list' },
        routeOverrides: {
          '/demo/form/address': {
            loader: async () => ({
              featuredItems: [
                { name: 'Item A', description: 'First featured item' },
                { name: 'Item B', description: 'Second featured item' },
              ],
            }),
          },
        },
      },
    },
  },
});
```

<!-- JS snippets still needed while providing both CSF 3 & Next -->

```js filename="Page.stories.js" renderer="react" language="js" tabTitle="CSF Next 🧪"
import preview from '../.storybook/preview';

import { Page } from './Page';

const meta = preview.meta({
  title: 'Example/Page',
  component: Page,
});

export default meta;

export const Default = meta.story({
  parameters: {
    tanstack: {
      router: {
        route: {
          path: '/demo/form/address',
        },
        query: { view: 'list' },
        routeOverrides: {
          '/demo/form/address': {
            loader: async () => ({
              featuredItems: [
                { name: 'Item A', description: 'First featured item' },
                { name: 'Item B', description: 'Second featured item' },
              ],
            }),
          },
        },
      },
    },
  },
});
```
