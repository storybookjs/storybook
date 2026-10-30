```ts filename="Page.stories.ts" renderer="react" language="ts" tabTitle="CSF 4"
import preview from '../.storybook/preview';

import { Route } from './Page';

const meta = preview.meta({
  parameters: {
    tanstack: {
      router: {
        route: Route,
      },
    },
  },
});

export const WithHash = meta.story({
  parameters: {
    tanstack: {
      // 👇 Provide the URL fragment (hash) for the route
      router: { path: '/#section-name' },
    },
  },
});

export const WithSearch = meta.story({
  parameters: {
    tanstack: {
      // 👇 Provide the query string for the route
      router: { query: { tab: 'details', page: '2' } },
    },
  },
});
```

```ts filename="Page.stories.ts" renderer="react" language="ts" tabTitle="CSF 3"
// ⚠️ CSF versions 1, 2, and 3 will be removed in a future version of Storybook. Upgrade to CSF 4: https://storybook.js.org/docs/writing-stories/csf#upgrade-to-csf-4
import type { Meta, StoryObj } from '@storybook/tanstack-react';

import { Route } from './Page';

const meta = {
  parameters: {
    tanstack: {
      router: {
        route: Route,
      },
    },
  },
} satisfies Meta<typeof Route>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WithHash: Story = {
  parameters: {
    tanstack: {
      // 👇 Provide the URL fragment (hash) for the route
      router: { path: '/#section-name' },
    },
  },
};

export const WithSearch: Story = {
  parameters: {
    tanstack: {
      // 👇 Provide the query string for the route
      router: { query: { tab: 'details', page: '2' } },
    },
  },
};
```
