```tsx filename="Button.test.tsx" renderer="react" language="ts"
import { test, expect } from 'vitest';
import { screen } from '@testing-library/react';
// 👉 Using Next.js? Import from @storybook/nextjs instead
import { composeStories } from '@storybook/react';

// Import all stories and the component annotations from the stories file
import * as stories from './Button.stories';

// Every component that is returned maps 1:1 with the stories,
// but they already contain all annotations from story, meta, and project levels
const { Primary, Secondary } = composeStories(stories);

test('renders primary button with default args', async () => {
  await Primary.run();
  const buttonElement = screen.getByText('Text coming from args in stories file!');
  expect(buttonElement).not.toBeNull();
});

test('renders primary button with overridden props', async () => {
  // You can override props by passing them in the context argument of the play function
  await Primary.run({ args: { ...Primary.args, children: 'Hello world' } });
  const buttonElement = screen.getByText(/Hello world/i);
  expect(buttonElement).not.toBeNull();
});
```

```ts filename="Button.test.ts" renderer="svelte" language="ts"
import { test, expect } from 'vitest';
import { screen } from '@testing-library/svelte';
import { composeStories } from '@storybook/svelte';

// Import all stories and the component annotations from the stories file
import * as stories from './Button.stories';

// Every component that is returned maps 1:1 with the stories,
// but they already contain all annotations from story, meta, and project levels
const { Primary, Secondary } = composeStories(stories);

test('renders primary button with default args', async () => {
  await Primary.run();
  const buttonElement = screen.getByText('Text coming from args in stories file!');
  expect(buttonElement).not.toBeNull();
});

test('renders primary button with overridden props', async () => {
  // You can override props by passing them in the context argument of the play function
  await Primary.run({ args: { ...Primary.args, children: 'Hello world' } });
  const buttonElement = screen.getByText(/Hello world/i);
  expect(buttonElement).not.toBeNull();
});
```

```ts filename="Button.test.ts" renderer="vue" language="ts"
import { test, expect } from 'vitest';
import { screen } from '@testing-library/vue';
import { composeStories } from '@storybook/vue3';

// Import all stories and the component annotations from the stories file
import * as stories from './Button.stories';

// Every component that is returned maps 1:1 with the stories,
// but they already contain all annotations from story, meta, and project levels
const { Primary, Secondary } = composeStories(stories);

test('renders primary button with default args', async () => {
  await Primary.run();
  const buttonElement = screen.getByText('Text coming from args in stories file!');
  expect(buttonElement).not.toBeNull();
});

test('renders primary button with overridden props', async () => {
  // You can override props by passing them in the context argument of the play function
  await Primary.run({ args: { ...Primary.args, children: 'Hello world' } });
  const buttonElement = screen.getByText(/Hello world/i);
  expect(buttonElement).not.toBeNull();
});
```
