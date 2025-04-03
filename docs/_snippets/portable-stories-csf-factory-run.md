```tsx filename="Button.test.tsx" renderer="react" language="ts"
import { test, expect } from 'vitest';
import { screen } from '@testing-library/react';

// Import all stories from the stories file
import * as stories from './Button.stories';

const { Primary, Secondary } = stories;

test('renders primary button with default args', async () => {
  // The run function will mount the component and run all of Storybook's lifecycle hooks
  await Primary.run();
  const buttonElement = screen.getByText('Text coming from args in stories file!');
  expect(buttonElement).not.toBeNull();
});

test('renders primary button with overridden props', async () => {
  // You can override props by passing them in the context argument of the run function
  await Primary.run({ args: { ...Primary.composed.args, children: 'Hello world' } });
  const buttonElement = screen.getByText(/Hello world/i);
  expect(buttonElement).not.toBeNull();
});
```
