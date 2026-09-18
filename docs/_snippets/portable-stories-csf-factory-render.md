```tsx filename="Button.test.tsx" renderer="react" language="ts"
import { test, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

// Import all stories from the stories file
import * as stories from './Button.stories';

const { Primary, Secondary } = stories;

test('renders primary button with default args', async () => {
  // Access the story's component via the .Component property
  render(<Primary.Component />);
  const buttonElement = screen.getByText('Text coming from args in stories file!');
  expect(buttonElement).not.toBeNull();
});

test('renders primary button with overridden props', async () => {
  // You can override props by passing them directly to the story's component
  render(<Primary.Component>Hello world</Primary.Component>);
  const buttonElement = screen.getByText(/Hello world/i);
  expect(buttonElement).not.toBeNull();
});
```
