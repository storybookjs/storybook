```js filename="RouterBasedComponent.stories.js" renderer="react" language="js" tabTitle="CSF (Legacy)"
import RouterBasedComponent from './RouterBasedComponent';

export default {
  component: RouterBasedComponent,
};

// Interact with the links to see the route change events in the Actions panel.
export const Example = {
  parameters: {
    nextjs: {
      router: {
        pathname: '/profile/[id]',
        asPath: '/profile/1',
        query: {
          id: '1',
        },
      },
    },
  },
};
```

```ts filename="RouterBasedComponent.stories.ts" renderer="react" language="ts" tabTitle="CSF (Legacy)"
// Replace your-framework with nextjs or nextjs-vite
import type { Meta, StoryObj } from '@storybook/your-framework';

import RouterBasedComponent from './RouterBasedComponent';

const meta = {
  component: RouterBasedComponent,
} satisfies Meta<typeof RouterBasedComponent>;

export default meta;
type Story = StoryObj<typeof meta>;

// Interact with the links to see the route change events in the Actions panel.
export const Example: Story = {
  parameters: {
    nextjs: {
      router: {
        pathname: '/profile/[id]',
        asPath: '/profile/1',
        query: {
          id: '1',
        },
      },
    },
  },
};
```

```ts filename="RouterBasedComponent.stories.ts" renderer="react" language="ts" tabTitle="CSF"
import preview from '../.storybook/preview';

import RouterBasedComponent from './RouterBasedComponent';

const meta = preview.meta({
  component: RouterBasedComponent,
});

// Interact with the links to see the route change events in the Actions panel.
export const Example = meta.story({
  parameters: {
    nextjs: {
      router: {
        pathname: '/profile/[id]',
        asPath: '/profile/1',
        query: {
          id: '1',
        },
      },
    },
  },
});
```

<!-- JS snippets still needed while providing both CSF 3 & Next -->

```js filename="RouterBasedComponent.stories.js" renderer="react" language="js" tabTitle="CSF"
import preview from '../.storybook/preview';

import RouterBasedComponent from './RouterBasedComponent';

const meta = preview.meta({
  component: RouterBasedComponent,
});

// Interact with the links to see the route change events in the Actions panel.
export const Example = meta.story({
  parameters: {
    nextjs: {
      router: {
        pathname: '/profile/[id]',
        asPath: '/profile/1',
        query: {
          id: '1',
        },
      },
    },
  },
});
```
