```ts filename="UserCard.stories.ts" renderer="react" language="ts" tabTitle="CSF 4"
import preview from '../.storybook/preview';

import { Route } from './UserCard';

const meta = preview.meta({
  title: 'Users/UserCard',
  parameters: {
    tanstack: {
      router: {
        route: Route,
        params: { userId: '42' },
        // 👇 Override the route's loader so the story doesn't call the real API.
        routeOverrides: {
          '/users/$userId': {
            loader: async () => ({ user: { id: '42', name: 'Ada Lovelace' } }),
          },
        },
      },
    },
  },
});

export const Default = meta.story();
```

```ts filename="UserCard.stories.ts" renderer="react" language="ts" tabTitle="CSF 3"
// ⚠️ CSF versions 1, 2, and 3 will be removed in a future version of Storybook. Upgrade to CSF 4: https://storybook.js.org/docs/writing-stories/csf#upgrade-to-csf-4
import type { Meta, StoryObj } from '@storybook/tanstack-react';

import { Route } from './UserCard';

const meta = {
  title: 'Users/UserCard',
  parameters: {
    tanstack: {
      router: {
        route: Route,
        params: { userId: '42' },
        // 👇 Override the route's loader so the story doesn't call the real API.
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
