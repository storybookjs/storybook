```tsx filename="Button.test.tsx" renderer="react" language="ts"
import { vi, test, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { composeStory } from '@storybook/react';

import meta, { Primary } from './Button.stories';

test('onclick handler is called', () => {
  // Returns a story which already contains all annotations from story, meta and global levels
  const PrimaryStory = composeStory(Primary, meta);

  const onClickSpy = vi.fn();
  render(<PrimaryStory onClick={onClickSpy} />);
  const buttonElement = screen.getByRole('button');
  buttonElement.click();
  expect(onClickSpy).toHaveBeenCalled();
});
```

```ts filename="Button.test.ts" renderer="svelte" language="ts"
import { vi, test, expect } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import { composeStory } from '@storybook/svelte';

import meta, { Primary } from './Button.stories';

test('renders primary button with default args', () => {
  // Returns a story which already contains all annotations from story, meta and global levels
  const PrimaryStory = composeStory(Primary, meta);

  render(PrimaryStory.Component, PrimaryStory.props);
  const buttonElement = screen.getByText('Text coming from args in stories file!');
  expect(buttonElement).not.toBeNull();
});

test('renders primary button with overridden props', () => {
  // You can override props and they will get merged with values from the story's args
  const PrimaryStory = composeStory({ ...Primary, args: { label: 'Hello world' } }, meta);

  render(PrimaryStory.Component, PrimaryStory.props);
  const buttonElement = screen.getByText(/Hello world/i);
  expect(buttonElement).not.toBeNull();
});
```

```ts filename="Button.test.ts" renderer="vue" language="ts"
import { vi, test, expect } from 'vitest';
import { render, screen } from '@testing-library/vue';
import { composeStory } from '@storybook/vue3';

import meta, { Primary } from './Button.stories';

test('onclick handler is called', () => {
  // Returns a story which already contains all annotations from story, meta and global levels
  const PrimaryStory = composeStory(Primary, meta);

  const onClickSpy = vi.fn();
  render(Primary, { props: { onClick: onClickSpy } });
  const buttonElement = screen.getByRole('button');
  buttonElement.click();
  expect(onClickSpy).toHaveBeenCalled();
});
```

