```ts filename="Page.stories.ts" renderer="react" language="ts" tabTitle="CSF 4"
import preview from '../.storybook/preview';

import { Page } from './Page';

const meta = preview.meta({
  component: Page,
});

export const Default = meta.story({
  parameters: {
    tanstack: {
      router: {
        route: {
          path: '/demo/form/address',
        },
        query: { view: 'list' },
      },
    },
  },
});
```

```ts filename="Page.stories.ts" renderer="react" language="ts" tabTitle="CSF 3"
// ⚠️ CSF versions 1, 2, and 3 will be removed in a future version of Storybook. Upgrade to CSF 4: https://storybook.js.org/docs/writing-stories/csf#upgrade-to-csf-4
import type { Meta, StoryObj } from '@storybook/tanstack-react';

import { Page } from './Page';

const meta = {
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
      },
    },
  },
};
```
