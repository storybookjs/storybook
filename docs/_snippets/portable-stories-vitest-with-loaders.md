```tsx filename="Button.test.tsx" renderer="react" language="ts"
import { test } from 'vitest';
import { render } from '@testing-library/react';
import { composeStory } from '@storybook/react';

import meta, { Primary } from './Button.stories';

test('applies the loaders and renders', async () => {
  const PrimaryStory = composeStory(Primary, meta);

  // First, load the data for the story
  await PrimaryStory.load();

  // Then, render the story
  render(<PrimaryStory />);
});
```

```ts filename="Button.test.ts" renderer="svelte" language="ts"
import { test } from 'vitest';
import { render } from '@testing-library/svelte';
import { composeStory } from '@storybook/svelte';

import meta, { Primary } from './Button.stories';

test('applies the loaders and renders', async () => {
  const PrimaryStory = composeStory(Primary, meta);

  // First, load the data for the story
  await PrimaryStory.load();

  // Then, render the story
  render(PrimaryStory.Component, PrimaryStory.props);
});
```

```ts filename="Button.test.ts" renderer="vue" language="ts"
import { test } from 'vitest';
import { render } from '@testing-library/vue';
import { composeStory } from '@storybook/vue3';

import meta, { Primary } from './Button.stories';

test('applies the loaders and renders', async () => {
  const PrimaryStory = composeStory(Primary, meta);

  // First, load the data for the story
  await PrimaryStory.load();

  // Then, render the story
  render(PrimaryStory);
});
```

