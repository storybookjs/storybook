```js filename="Page.stories.js" renderer="react" language="js" tabTitle="CSF 3"
import { Route } from './Page';

export default {
  parameters: {
    tanstack: {
      router: {
        route: Route,
      },
    },
  },
};

export const WithHash = {
  parameters: {
    tanstack: {
      // 👇 Provide the URL fragment (hash) for the route
      router: { path: '/#section-name' },
    },
  },
};

export const WithSearch = {
  parameters: {
    tanstack: {
      // 👇 Provide the query string for the route
      router: { query: { tab: 'details', page: '2' } },
    },
  },
};
```

```ts filename="Page.stories.ts" renderer="react" language="ts" tabTitle="CSF 3"
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

```ts filename="Page.stories.ts" renderer="react" language="ts" tabTitle="CSF Next 🧪"
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

```js filename="Page.stories.js" renderer="react" language="js" tabTitle="CSF Next 🧪"
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
