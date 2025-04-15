```js filename="NavigationBasedComponent.stories.js" renderer="react" language="js"
import NavigationBasedComponent from './NavigationBasedComponent';

export default {
  component: NavigationBasedComponent,
  parameters: {
    nextjs: {
      appDirectory: true, // 👈 Set this
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
      appDirectory: true, // 👈 Set this
    },
  },
} satisfies Meta<typeof NavigationBasedComponent>;
export default meta;
```

```ts filename="NavigationBasedComponent.stories.ts" renderer="react" language="ts"
import { Meta, StoryObj } from '@storybook/react';

import NavigationBasedComponent from './NavigationBasedComponent';

const meta: Meta<typeof NavigationBasedComponent> = {
  component: NavigationBasedComponent,
  parameters: {
    nextjs: {
      appDirectory: true, // 👈 Set this
    },
  },
};
export default meta;
```
