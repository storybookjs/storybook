```js filename="Button.stories.js" renderer="react" language="js"
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

```ts filename="Button.stories.ts" renderer="react" language="ts-4-9"
import type { Meta, StoryObj } from '@storybook/react';

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

```ts filename="Button.stories.ts" renderer="react" language="ts"
import type { Meta, StoryObj } from '@storybook/react';

import { Button } from './Button';

const meta: Meta<typeof Button> = {
  component: Button,
};
export default meta;

type Story = StoryObj<typeof Button>;

// Wrapped in light theme
export const Default: Story = {};

// Wrapped in dark theme
export const Dark: Story = {
  parameters: {
    theme: 'dark',
  },
};
```
