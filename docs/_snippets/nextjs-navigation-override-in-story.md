```js filename="NavigationBasedComponent.stories.js" renderer="react" language="js"
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

```ts filename="NavigationBasedComponent.stories.ts" renderer="react" language="ts-4-9"
import { Meta, StoryObj } from '@storybook/react';

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

type Story = StoryObj<typeof Meta>;

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

```ts filename="NavigationBasedComponent.stories.ts" renderer="react" language="ts"
import { Meta, StoryObj } from '@storybook/react';

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

