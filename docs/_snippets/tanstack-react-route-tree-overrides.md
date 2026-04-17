```js filename="UserCard.stories.js" renderer="react" language="js" tabTitle="CSF 3"
import { Route } from './UserCard';

export default {
  title: 'Users/UserCard',
  parameters: {
    tanstack: {
      router: {
        route: Route,
        params: { userId: '42' },
        // Override the route's loader so the story doesn't call the real API.
        routeOverrides: {
          '/users/$userId': {
            loader: async () => ({ user: { id: '42', name: 'Ada Lovelace' } }),
          },
        },
      },
    },
  },
};

export const Default = {};
```

```ts filename="UserCard.stories.ts" renderer="react" language="ts" tabTitle="CSF 3"
import type { Meta, StoryObj } from '@storybook/tanstack-react';

import { Route } from './UserCard';

const meta = {
  title: 'Users/UserCard',
  parameters: {
    tanstack: {
      router: {
        route: Route,
        params: { userId: '42' },
        // Override the route's loader so the story doesn't call the real API.
        routeOverrides: {
          '/users/$userId': {
            loader: async () => ({ user: { id: '42', name: 'Ada Lovelace' } }),
          },
        },
      },
    },
  },
} satisfies Meta<typeof Route>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
```

```ts filename="UserCard.stories.ts" renderer="react" language="ts" tabTitle="CSF Next 🧪"
import preview from '../.storybook/preview';

import { Route } from './UserCard';

const meta = preview.meta({
  title: 'Users/UserCard',
  parameters: {
    tanstack: {
      router: {
        route: Route,
        params: { userId: '42' },
        // Override the route's loader so the story doesn't call the real API.
        routeOverrides: {
          '/users/$userId': {
            loader: async () => ({ user: { id: '42', name: 'Ada Lovelace' } }),
          },
        },
      },
    },
  },
});

export default meta;

export const Default = meta.story({});
```

<!-- JS snippets still needed while providing both CSF 3 & Next -->

```js filename="UserCard.stories.js" renderer="react" language="js" tabTitle="CSF Next 🧪"
import preview from '../.storybook/preview';

import { Route } from './UserCard';

const meta = preview.meta({
  title: 'Users/UserCard',
  parameters: {
    tanstack: {
      router: {
        route: Route,
        params: { userId: '42' },
        // Override the route's loader so the story doesn't call the real API.
        routeOverrides: {
          '/users/$userId': {
            loader: async () => ({ user: { id: '42', name: 'Ada Lovelace' } }),
          },
        },
      },
    },
  },
});

export default meta;

export const Default = meta.story({});
```
