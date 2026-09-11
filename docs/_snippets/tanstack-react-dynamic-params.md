```ts filename="Showcase.stories.ts" renderer="react" language="ts" tabTitle="CSF 3"
import type { Meta } from '@storybook/tanstack-react';

import { Route } from './$id';

const meta = {
  parameters: {
    tanstack: {
      router: {
        route: Route,
        params: { id: '42' },
        routeOverrides: {
          '/showcase/$id': {
            loader: () => ({ item: mockItem }),
          },
        },
      },
    },
  },
} satisfies Meta<typeof Route>;

export default meta;
```

```ts filename="Showcase.stories.ts" renderer="react" language="ts" tabTitle="CSF Next 🧪"
import preview from '../.storybook/preview';

import { Route } from './$id';

const meta = preview.meta({
  parameters: {
    tanstack: {
      router: {
        route: Route,
        params: { id: '42' },
        routeOverrides: {
          '/showcase/$id': {
            loader: () => ({ item: mockItem }),
          },
        },
      },
    },
  },
});
```
