```js filename="NavigationBasedComponent.stories.js" renderer="react" language="js" tabTitle="CSF 3"
import NavigationBasedComponent from './NavigationBasedComponent';

export default {
  component: NavigationBasedComponent,
  parameters: {
    nextjs: {
      appDirectory: true,
      navigation: {
        segments: ['dashboard', 'analytics'],
      },
    },
  },
};
```

```ts filename="NavigationBasedComponent.stories.ts" renderer="react" language="ts" tabTitle="CSF 3"
// Replace your-framework with nextjs or nextjs-vite
import type { Meta, StoryObj } from '@storybook/your-framework';

import NavigationBasedComponent from './NavigationBasedComponent';

const meta = {
  component: NavigationBasedComponent,
  parameters: {
    nextjs: {
      appDirectory: true,
      navigation: {
        segments: ['dashboard', 'analytics'],
      },
    },
  },
} satisfies Meta<typeof NavigationBasedComponent>;
export default meta;
```

```ts filename="NavigationBasedComponent.stories.ts" renderer="react" language="ts" tabTitle="CSF Next 🧪"
import preview from '../.storybook/preview';

import NavigationBasedComponent from './NavigationBasedComponent';

const meta = preview.meta({
  component: NavigationBasedComponent,
  parameters: {
    nextjs: {
      appDirectory: true,
      navigation: {
        segments: ['dashboard', 'analytics'],
      },
    },
  },
});
```

<!-- JS snippets still needed while providing both CSF 3 & Next -->

```js filename="NavigationBasedComponent.stories.js" renderer="react" language="js" tabTitle="CSF Next 🧪"
import preview from '../.storybook/preview';
import NavigationBasedComponent from './NavigationBasedComponent';

const meta = preview.meta({
  component: NavigationBasedComponent,
  parameters: {
    nextjs: {
      appDirectory: true,
      navigation: {
        segments: ['dashboard', 'analytics'],
      },
    },
  },
});
```
