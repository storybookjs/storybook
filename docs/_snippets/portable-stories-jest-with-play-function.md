```tsx filename="Button.test.tsx" renderer="react" language="ts"
import { test } from '@jest/globals';
// 👉 Using Next.js? Import from @storybook/nextjs instead
import { composeStories } from '@storybook/react';

import * as stories from './Button.stories';

const { Primary } = composeStories(stories);

test('renders and executes the play function', async () => {
  // Mount story and run interactions
  await Primary.run();
});
```

```ts filename="Button.test.ts" renderer="vue" language="ts"
import { test } from '@jest/globals';
import { composeStories } from '@storybook/vue3';

import * as stories from './Button.stories';

const { Primary } = composeStories(stories);

test('renders and executes the play function', async () => {
  // Mount story and run interactions
  await Primary.run();
});
```
