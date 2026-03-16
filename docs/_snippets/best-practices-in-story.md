```js filename="Button.stories.js|jsx" renderer="react" language="js" tabTitle="CSF 3"
import { Button } from './Button';

export default {
  component: Button,
};

// ✅ Good - shows the default state
export const Basic = {};

// ✅ Good - demonstrates a specific use case
export const Primary = {
  args: { primary: true },
};

// ✅ Good - even though this story renders more than one button,
// they both demonstrate the same concept of a disabled button
export const Disabled = {
  args: { disabled: true },
  render: (args) => (
    <>
      <Button {...args}>Disabled Button</Button>
      <Button {...args} primary>
        Disabled Primary Button
      </Button>
    </>
  ),
};

// ❌ Bad - demonstrates too many concepts at once, making
// it less clear and less useful as a reference for agents
export const SizesAndVariants = {
  render: () => (
    <>
      <Button size="small">Small Button</Button>
      <Button>Medium Button</Button>
      <Button size="large">Large Button</Button>
      <Button variant="outline">Outline Button</Button>
      <Button variant="text">Text Button</Button>
    </>
  ),
};
```

```ts filename="Button.stories.ts|tsx" renderer="react" language="ts" tabTitle="CSF 3"
// Replace your-framework with the framework you are using, e.g. react-vite, nextjs, nextjs-vite, etc.
import type { Meta, StoryObj } from '@storybook/your-framework';

import { Button } from './Button';

const meta = {
  component: Button,
} satisfies Meta<typeof Button>;

export default meta;

type Story = StoryObj<typeof meta>;

// ✅ Good to show the default state
export const Basic: Story = {};

// ✅ Good to demonstrate a specific use case
export const Primary: Story = {
  args: { primary: true },
};

// ✅ Good - even though this story renders more than one button,
// they both demonstrate the same concept of a disabled button
export const Disabled: Story = {
  args: { disabled: true },
    render: (args) => (
      <>
      <Button {...args}>Disabled Button</Button>
      <Button {...args} primary>
        Disabled Primary Button
      </Button>
    </>
  ),
};

// ❌ Bad - demonstrates too many concepts at once, making
// it less clear and less useful as a reference for agents
export const SizesAndVariants: Story = {
  render: () => (
    <>
      <Button size="small">Small Button</Button>
      <Button>Medium Button</Button>
      <Button size="large">Large Button</Button>
      <Button variant="outline">Outline Button</Button>
      <Button variant="text">Text Button</Button>
    </>
  ),
};
```

```ts filename="Button.stories.ts|tsx" renderer="react" language="ts" tabTitle="CSF Next 🧪"
import preview from '../.storybook/preview';

import { Button } from './Button';

const meta = preview.meta({
  component: Button,
});

// ✅ Good to show the default state
export const Basic = meta.story();

// ✅ Good to demonstrate a specific use case
export const Primary = meta.story({
  args: { primary: true },
});

// ✅ Good - even though this story renders more than one button,
// they both demonstrate the same concept of a disabled button
export const Disabled = meta.story({
  args: { disabled: true },
  render: (args) => (
    <>
      <Button {...args}>Disabled Button</Button>
      <Button {...args} primary>
        Disabled Primary Button
      </Button>
    </>
  ),
});

// ❌ Bad - demonstrates too many concepts at once, making
// it less clear and less useful as a reference for agents
export const SizesAndVariants = meta.story({
  render: () => (
    <>
      <Button size="small">Small Button</Button>
      <Button>Medium Button</Button>
      <Button size="large">Large Button</Button>
      <Button variant="outline">Outline Button</Button>
      <Button variant="text">Text Button</Button>
    </>
  ),
});
```

<!-- JS snippets still needed while providing both CSF 3 & Next -->

```js filename="Button.stories.js|jsx" renderer="react" language="js" tabTitle="CSF Next 🧪"
import preview from '../.storybook/preview';

import { Button } from './Button';

const meta = preview.meta({
  component: Button,
});

// ✅ Good to show the default state
export const Basic = meta.story();

// ✅ Good to demonstrate a specific use case
export const Primary = meta.story({
  args: { primary: true },
});

// ✅ Good - even though this story renders more than one button,
// they both demonstrate the same concept of a disabled button
export const Disabled = meta.story({
  args: { disabled: true },
  render: (args) => (
    <>
      <Button {...args}>Disabled Button</Button>
      <Button {...args} primary>
        Disabled Primary Button
      </Button>
    </>
  ),
});

// ❌ Bad - demonstrates too many concepts at once, making
// it less clear and less useful as a reference for agents
export const SizesAndVariants = meta.story({
  render: () => (
    <>
      <Button size="small">Small Button</Button>
      <Button>Medium Button</Button>
      <Button size="large">Large Button</Button>
      <Button variant="outline">Outline Button</Button>
      <Button variant="text">Text Button</Button>
    </>
  ),
});
```
