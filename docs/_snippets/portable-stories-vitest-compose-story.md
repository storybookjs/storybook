```tsx filename="Button.test.tsx" renderer="react" language="ts"
import { vi, test, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { composeStory } from '@storybook/react';

import meta, { Primary as PrimaryStory } from './Button.stories';

// Returns a story which already contains all annotations from story, meta and global levels
const Primary = composeStory(PrimaryStory, meta);

test('renders primary button with default args', async () => {
  await Primary.run();

  const buttonElement = screen.getByText('Text coming from args in stories file!');
  expect(buttonElement).not.toBeNull();
});

test('renders primary button with overridden props', async () => {
  await Primary.run({ args: { ...Primary.args, label: 'Hello world' } });

  const buttonElement = screen.getByText(/Hello world/i);
  expect(buttonElement).not.toBeNull();
});
```

```ts filename="Button.test.ts" renderer="svelte" language="ts"
import { vi, test, expect } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import { composeStory } from '@storybook/svelte';

import meta, { Primary as PrimaryStory } from './Button.stories';

// Returns a story which already contains all annotations from story, meta and global levels
const Primary = composeStory(PrimaryStory, meta);

test('renders primary button with default args', async () => {
  await Primary.run();

  const buttonElement = screen.getByText('Text coming from args in stories file!');
  expect(buttonElement).not.toBeNull();
});

test('renders primary button with overridden props', async () => {
  await Primary.run({ args: { ...Primary.args, label: 'Hello world' } });

  const buttonElement = screen.getByText(/Hello world/i);
  expect(buttonElement).not.toBeNull();
});
```

```ts filename="Button.test.ts" renderer="vue" language="ts"
import { vi, test, expect } from 'vitest';
import { render, screen } from '@testing-library/vue';
import { composeStory } from '@storybook/vue3';

import meta, { Primary as PrimaryStory } from './Button.stories';

// Returns a story which already contains all annotations from story, meta and global levels
const Primary = composeStory(PrimaryStory, meta);

test('renders primary button with default args', async () => {
  await Primary.run();

  const buttonElement = screen.getByText('Text coming from args in stories file!');
  expect(buttonElement).not.toBeNull();
});

test('renders primary button with overridden props', async () => {
  await Primary.run({ args: { ...Primary.args, label: 'Hello world' } });

  const buttonElement = screen.getByText(/Hello world/i);
  expect(buttonElement).not.toBeNull();
});
```
