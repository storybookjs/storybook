```js filename="NavigationBasedComponent.stories.js" renderer="react" language="js" tabTitle="CSF (Legacy)"
import NavigationBasedComponent from './NavigationBasedComponent';

export default {
  component: NavigationBasedComponent,
  parameters: {
    nextjs: {
      appDirectory: true,
    },
  },
};

// Interact with the links to see the route change events in the Actions panel.
export const Example = {
  parameters: {
    nextjs: {
      navigation: {
        pathname: '/profile',
        query: {
          user: '1',
        },
      },
    },
  },
};
```

```ts filename="NavigationBasedComponent.stories.ts" renderer="react" language="ts" tabTitle="CSF (Legacy)"
// Replace your-framework with nextjs or nextjs-vite
import type { Meta, StoryObj } from '@storybook/your-framework';

import NavigationBasedComponent from './NavigationBasedComponent';

const meta = {
  component: NavigationBasedComponent,
  parameters: {
    nextjs: {
      appDirectory: true,
    },
  },
} satisfies Meta<typeof NavigationBasedComponent>;
export default meta;

type Story = StoryObj<typeof meta>;

// Interact with the links to see the route change events in the Actions panel.
export const Example: Story = {
  parameters: {
    nextjs: {
      navigation: {
        pathname: '/profile',
        query: {
          user: '1',
        },
      },
    },
  },
};
```

```ts filename="NavigationBasedComponent.stories.ts" renderer="react" language="ts" tabTitle="CSF"
import preview from '../.storybook/preview';

import NavigationBasedComponent from './NavigationBasedComponent';

const meta = preview.meta({
  component: NavigationBasedComponent,
  parameters: {
    nextjs: {
      appDirectory: true,
    },
  },
});

// Interact with the links to see the route change events in the Actions panel.
export const Example = meta.story({
  parameters: {
    nextjs: {
      navigation: {
        pathname: '/profile',
        query: {
          user: '1',
        },
      },
    },
  },
});
```

<!-- JS snippets still needed while providing both CSF 3 & Next -->

```js filename="NavigationBasedComponent.stories.js" renderer="react" language="js" tabTitle="CSF"
import preview from '../.storybook/preview';

import NavigationBasedComponent from './NavigationBasedComponent';

const meta = preview.meta({
  component: NavigationBasedComponent,
  parameters: {
    nextjs: {
      appDirectory: true,
    },
  },
});

// Interact with the links to see the route change events in the Actions panel.
export const Example = meta.story({
  parameters: {
    nextjs: {
      navigation: {
        pathname: '/profile',
        query: {
          user: '1',
        },
      },
    },
  },
});
```
