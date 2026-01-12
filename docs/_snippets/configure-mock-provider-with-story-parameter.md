```js filename="Button.stories.js" renderer="react" language="js" tabTitle="CSF 3"
import { Button } from './Button';

export default {
  component: Button,
};

// Wrapped in light theme
export const Default = {};

// Wrapped in dark theme
export const Dark = {
  parameters: {
    theme: 'dark',
  },
};
```

```ts filename="Button.stories.ts" renderer="react" language="ts" tabTitle="CSF 3"
// Replace your-framework with the framework you are using, e.g. react-vite, nextjs, nextjs-vite, etc.
import type { Meta, StoryObj } from '@storybook/your-framework';

import { Button } from './Button';

const meta = {
  component: Button,
} satisfies Meta<typeof Button>;
export default meta;

type Story = StoryObj<typeof meta>;

// Wrapped in light theme
export const Default: Story = {};

// Wrapped in dark theme
export const Dark: Story = {
  parameters: {
    theme: 'dark',
  },
};
```

```ts filename="Button.stories.ts" renderer="react" language="ts" tabTitle="CSF Next 🧪"
import preview from '../.storybook/preview';

import { Button } from './Button';

const meta = preview.meta({
  component: Button,
});

// Wrapped in light theme
export const Default = meta.story();

// Wrapped in dark theme
export const Dark = meta.story({
  parameters: {
    theme: 'dark',
  },
});
```

<!-- JS snippets still needed while providing both CSF 3 & Next -->

```js filename="Button.stories.js" renderer="react" language="js" tabTitle="CSF Next 🧪"
import preview from '../.storybook/preview';

import { Button } from './Button';

const meta = preview.meta({
  component: Button,
});

// Wrapped in light theme
export const Default = meta.story();

// Wrapped in dark theme
export const Dark = meta.story({
  parameters: {
    theme: 'dark',
  },
});
```
