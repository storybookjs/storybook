```js filename="NavigationBasedComponent.stories.js" renderer="react" language="js" tabTitle="CSF 4"
import preview from '../.storybook/preview';

import NavigationBasedComponent from './NavigationBasedComponent';

const meta = preview.meta({
  component: NavigationBasedComponent,
  parameters: {
    nextjs: {
      appDirectory: true,
      navigation: {
        segments: [
          ['slug', 'hello'],
          ['framework', 'nextjs'],
        ],
      },
    },
  },
});
```

```ts filename="NavigationBasedComponent.stories.ts" renderer="react" language="ts" tabTitle="CSF 4"
import preview from '../.storybook/preview';

import NavigationBasedComponent from './NavigationBasedComponent';

const meta = preview.meta({
  component: NavigationBasedComponent,
  parameters: {
    nextjs: {
      appDirectory: true,
      navigation: {
        segments: [
          ['slug', 'hello'],
          ['framework', 'nextjs'],
        ],
      },
    },
  },
});
```

```ts filename="NavigationBasedComponent.stories.ts" renderer="react" language="ts" tabTitle="CSF 3"
// ⚠️ CSF versions 1, 2, and 3 will be removed in a future version of Storybook. Upgrade to CSF 4: https://storybook.js.org/docs/writing-stories/csf#upgrade-to-csf-4
// Replace your-framework with nextjs or nextjs-vite
import type { Meta, StoryObj } from '@storybook/your-framework';

import NavigationBasedComponent from './NavigationBasedComponent';

const meta = {
  component: NavigationBasedComponent,
  parameters: {
    nextjs: {
      appDirectory: true,
      navigation: {
        segments: [
          ['slug', 'hello'],
          ['framework', 'nextjs'],
        ],
      },
    },
  },
} satisfies Meta<typeof NavigationBasedComponent>;
export default meta;
```

```js filename="NavigationBasedComponent.stories.js" renderer="react" language="js" tabTitle="CSF 3"
// ⚠️ CSF versions 1, 2, and 3 will be removed in a future version of Storybook. Upgrade to CSF 4: https://storybook.js.org/docs/writing-stories/csf#upgrade-to-csf-4
import NavigationBasedComponent from './NavigationBasedComponent';

export default {
  component: NavigationBasedComponent,
  parameters: {
    nextjs: {
      appDirectory: true,
      navigation: {
        segments: [
          ['slug', 'hello'],
          ['framework', 'nextjs'],
        ],
      },
    },
  },
};
```
