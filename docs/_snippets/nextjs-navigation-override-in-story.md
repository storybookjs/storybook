```js filename="NavigationBasedComponent.stories.js" renderer="react" language="js" tabTitle="CSF 3"
import NavigationBasedComponent from './NavigationBasedComponent';

export default {
  component: NavigationBasedComponent,
  parameters: {
    nextjs: {
      appDirectory: true,
    },
  },
};

// If you have the actions addon,
// you can interact with the links and see the route change events there
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

```js filename="NavigationBasedComponent.stories.js" renderer="react" language="js" tabTitle="CSF Next 🧪"
// Learn about the # subpath import: https://storybook.js.org/docs/api/csf/csf-factories#subpath-imports
import preview from '#.storybook/preview';

import NavigationBasedComponent from './NavigationBasedComponent';

const meta = preview.meta({
  component: NavigationBasedComponent,
  parameters: {
    nextjs: {
      appDirectory: true,
    },
  },
});

// If you have the actions addon,
// you can interact with the links and see the route change events there
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

```ts filename="NavigationBasedComponent.stories.ts" renderer="react" language="ts-4-9" tabTitle="CSF 3"
import type { Meta, StoryObj } from '@storybook/react';

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

// If you have the actions addon,
// you can interact with the links and see the route change events there
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

```ts filename="NavigationBasedComponent.stories.ts" renderer="react" language="ts-4-9" tabTitle="CSF Next 🧪"
// Learn about the # subpath import: https://storybook.js.org/docs/api/csf/csf-factories#subpath-imports
import preview from '#.storybook/preview';

import NavigationBasedComponent from './NavigationBasedComponent';

const meta = preview.meta({
  component: NavigationBasedComponent,
  parameters: {
    nextjs: {
      appDirectory: true,
    },
  },
});

// If you have the actions addon,
// you can interact with the links and see the route change events there
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

```ts filename="NavigationBasedComponent.stories.ts" renderer="react" language="ts" tabTitle="CSF 3"
import type { Meta, StoryObj } from '@storybook/react';

import NavigationBasedComponent from './NavigationBasedComponent';

const meta: Meta<typeof NavigationBasedComponent> = {
  component: NavigationBasedComponent,
  parameters: {
    nextjs: {
      appDirectory: true,
    },
  },
};
export default meta;

type Story = StoryObj<typeof NavigationBasedComponent>;

// If you have the actions addon,
// you can interact with the links and see the route change events there
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

```ts filename="NavigationBasedComponent.stories.ts" renderer="react" language="ts" tabTitle="CSF Next 🧪"
// Learn about the # subpath import: https://storybook.js.org/docs/api/csf/csf-factories#subpath-imports
import preview from '#.storybook/preview';

import NavigationBasedComponent from './NavigationBasedComponent';

const meta = preview.meta({
  component: NavigationBasedComponent,
  parameters: {
    nextjs: {
      appDirectory: true,
    },
  },
});

// If you have the actions addon,
// you can interact with the links and see the route change events there
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
