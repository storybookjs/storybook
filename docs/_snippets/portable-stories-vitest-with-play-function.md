```tsx filename="Button.test.tsx" renderer="react" language="ts"
import { test } from 'vitest';
import { render } from '@testing-library/react';
import { composeStory } from '@storybook/react';

import meta, { Primary } from './Button.stories';

test('renders and executes the play function', async () => {
  const PrimaryStory = composeStory(Primary, meta);

  // First, render the story
  render(<PrimaryStory />);

  // Then, execute the play function
  await PrimaryStory.play();
});
```

```ts filename="Button.test.ts" renderer="svelte" language="ts"
import { test } from 'vitest';
import { render } from '@testing-library/svelte';
import { composeStory } from '@storybook/svelte';

import meta, { Primary } from './Button.stories';

test('renders and executes the play function', async () => {
  const PrimaryStory = composeStory(Primary, meta);

  // First, render the story
  render(PrimaryStory.Component, PrimaryStory.props);

  // Then, execute the play function
  await PrimaryStory.play();
});
```

```ts filename="Button.test.ts" renderer="vue" language="ts"
import { test } from 'vitest';
import { render } from '@testing-library/vue';
import { composeStory } from '@storybook/vue3';

import meta, { Primary } from './Button.stories';

test('renders and executes the play function', async () => {
  const PrimaryStory = composeStory(Primary, meta);

  // First, render the story
  render(PrimaryStory);

  // Then, execute the play function
  await PrimaryStory.play();
});
```

