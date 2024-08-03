```tsx filename="Button.playwright.test.tsx" renderer="react" language="ts"
import { createTest } from '@storybook/react/experimental-playwright';
import { test as base } from '@playwright/experimental-ct-react';

// See explanation below for `.portable` stories file
import stories from './Button.stories.portable';

const test = createTest(base);

test('renders primary button', async ({ mount }) => {
  // The mount function will execute all the necessary steps in the story,
  // such as loaders, render, and play function
  await mount(<stories.Primary />);
});

test('renders primary button with overridden props', async ({ mount }) => {
  // You can pass custom props to your component via JSX
  const component = await mount(<stories.Primary label="label from test" />);
  await expect(component).toContainText('label from test');
  await expect(component.getByRole('button')).toHaveClass(/storybook-button--primary/);
});
```

```ts filename="Button.playwright.test.ts" renderer="vue" language="ts"
import { createTest } from '@storybook/vue3/experimental-playwright';
import { test as base } from '@playwright/experimental-ct-vue';

// See explanation below for `.portable` stories file
import stories from './Button.stories.portable';

const test = createTest(base);

// 👉 Important: Due to current limitations, you can only reference your stories as JSX elements.

test('renders primary button', async ({ mount }) => {
  // The mount function will execute all the necessary steps in the story,
  // such as loaders, render, and play function
  await mount(<stories.Primary />);
});

test('renders primary button with overridden props', async ({ mount }) => {
  // You can pass custom props to your component via JSX
  const component = await mount(<stories.Primary label="label from test" />);
  await expect(component).toContainText('label from test');
  await expect(component.getByRole('button')).toHaveClass(/storybook-button--primary/);
});
```

