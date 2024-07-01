```js filename="RouterBasedComponent.stories.js" renderer="react" language="js"
import RouterBasedComponent from './RouterBasedComponent';

export default {
  component: RouterBasedComponent,
};

// If you have the actions addon,
// you can interact with the links and see the route change events there
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

```ts filename="RouterBasedComponent.stories.ts" renderer="react" language="ts-4-9"
import { Meta, StoryObj } from '@storybook/react';

import RouterBasedComponent from './RouterBasedComponent';

const meta = {
  component: RouterBasedComponent,
} satisfies Meta<typeof RouterBasedComponent>;
export default meta;

type Story = StoryObj<typeof Meta>;

// If you have the actions addon,
// you can interact with the links and see the route change events there
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

```ts filename="RouterBasedComponent.stories.ts" renderer="react" language="ts"
import { Meta, StoryObj } from '@storybook/react';

import RouterBasedComponent from './RouterBasedComponent';

const meta: Meta<typeof RouterBasedComponent> = {
  component: RouterBasedComponent,
};
export default meta;

type Story = StoryObj<typeof RouterBasedComponent>;

// If you have the actions addon,
// you can interact with the links and see the route change events there
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

