```ts filename="SettingsProfile.stories.ts" renderer="react" language="ts" tabTitle="CSF 3"
import type { Meta, StoryObj } from '@storybook/tanstack-react';

// 👇 Route file is part of the app route tree
import { Route } from './routes/_authenticated/settings/profile';

const meta = {
  parameters: {
    tanstack: {
      router: {
        // 👇 Storybook walks up the tree to root and duplicates the full route tree,
        //    so parent layouts (e.g. the authenticated shell) also render.
        route: Route,
        path: '/settings/profile',
        // 👇 Stub out any parent route guards so the story can render standalone.
        routeOverrides: {
          '/_authenticated': { beforeLoad: () => {} },
        },
      },
    },
  },
} satisfies Meta<typeof Route>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
```

```ts filename="SettingsProfile.stories.ts" renderer="react" language="ts" tabTitle="CSF Next 🧪"
import preview from '../.storybook/preview';

// 👇 Route file is part of the app route tree
import { Route } from './routes/_authenticated/settings/profile';

const meta = preview.meta({
  parameters: {
    tanstack: {
      router: {
        // 👇 Storybook walks up the tree to root and duplicates the full route tree,
        //    so parent layouts (e.g. the authenticated shell) also render.
        route: Route,
        path: '/settings/profile',
        // 👇 Stub out any parent route guards so the story can render standalone.
        routeOverrides: {
          '/_authenticated': { beforeLoad: () => {} },
        },
      },
    },
  },
});

export const Default = meta.story();
```
