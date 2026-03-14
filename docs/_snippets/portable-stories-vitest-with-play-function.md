```tsx filename="Button.test.tsx" renderer="react" language="ts"
import { test } from 'vitest';
// Replace your-framework with the framework you are using, e.g. react-vite, nextjs, nextjs-vite, etc.
import { composeStories } from '@storybook/your-framework';

import * as stories from './Button.stories';

const { Primary } = composeStories(stories);

test('renders and executes the play function', async () => {
  // Mount story and run interactions
  await Primary.run();
});
```

```ts filename="Button.test.ts" renderer="svelte" language="ts"
import { test } from 'vitest';
// Replace your-framework with the framework you are using, e.g. sveltekit or svelte-vite
import { composeStories } from '@storybook/your-framework';

import * as stories from './Button.stories';

const { Primary } = composeStories(stories);

test('renders and executes the play function', async () => {
  // Mount story and run interactions
  await Primary.run();
});
```

```ts filename="Button.test.ts" renderer="vue" language="ts"
import { test } from 'vitest';
import { composeStory } from '@storybook/vue3-vite';

import * as stories from './Button.stories';

const { Primary } = composeStories(stories);

test('renders and executes the play function', async () => {
  // Mount story and run interactions
  await Primary.run();
});
```
