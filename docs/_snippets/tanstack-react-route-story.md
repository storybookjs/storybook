```js filename="Page.stories.js" renderer="react" language="js" tabTitle="CSF 3"
import { Route } from './Page';

export default {
  parameters: {
    layout: 'fullscreen',
    tanstack: {
      router: {
        route: Route, // 👈 Supply the Route here
        params: { id: '42' },
        query: { tab: 'details' },
      },
    },
  },
};

export const Default = {};

export const WithCustomLoader = {
  parameters: {
    tanstack: {
      router: {
        route: Route, // 👈 Supply the Route here
        params: { id: '42' },
        routeOverrides: {
          '/items/$id': {
            loader: async () => ({
              item: { id: '42', name: 'Loaded inside Storybook' },
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

import { Route } from './Page';

const meta = {
  parameters: {
    layout: 'fullscreen',
    tanstack: {
      router: {
        route: Route, // 👈 Supply the Route here
        // 👇 Rest of these properties are type-safe
        params: { id: '42' },
        query: { tab: 'details' },
      },
    },
  },
} satisfies Meta<typeof Route>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithCustomLoader: Story = {
  parameters: {
    tanstack: {
      router: {
        route: Route, // 👈 Supply the Route here
        // 👇 Rest of these properties are type-safe
        params: { id: '42' },
        routeOverrides: {
          '/items/$id': {
            loader: async () => ({
              item: { id: '42', name: 'Loaded inside Storybook' },
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

import { Route } from './Page';

const meta = preview.meta({
  parameters: {
    layout: 'fullscreen',
    tanstack: {
      router: {
        route: Route, // 👈 Supply the Route here
        // 👇 Rest of these properties are type-safe
        params: { id: '42' },
        query: { tab: 'details' },
      },
    },
  },
});

export const Default = meta.story();

export const WithCustomLoader = meta.story({
  parameters: {
    tanstack: {
      router: {
        route: Route, // 👈 Supply the Route here
        // 👇 Rest of these properties are type-safe
        params: { id: '42' },
        routeOverrides: {
          '/items/$id': {
            loader: async () => ({
              item: { id: '42', name: 'Loaded inside Storybook' },
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

import { Route } from './Page';

const meta = preview.meta({
  parameters: {
    layout: 'fullscreen',
    tanstack: {
      router: {
        route: Route, // 👈 Supply the Route here
        params: { id: '42' },
        query: { tab: 'details' },
      },
    },
  },
});

export const Default = meta.story();

export const WithCustomLoader = meta.story({
  parameters: {
    tanstack: {
      router: {
        route: Route, // 👈 Supply the Route here
        params: { id: '42' },
        routeOverrides: {
          '/items/$id': {
            loader: async () => ({
              item: { id: '42', name: 'Loaded inside Storybook' },
            }),
          },
        },
      },
    },
  },
});
```
