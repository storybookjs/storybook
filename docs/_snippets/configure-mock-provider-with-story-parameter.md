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

```js filename="Button.stories.js" renderer="react" language="js" tabTitle="CSF Factory 🧪"
// Learn about the # subpath import: https://storybook.js.org/docs/api/csf/csf-factories#subpath-imports
import preview from '#.storybook/preview';

import { Button } from './Button';

const meta = preview.meta({
  component: Button,
});

// Wrapped in light theme
export const Default = meta.story({});

// Wrapped in dark theme
export const Dark = meta.story({
  parameters: {
    theme: 'dark',
  },
});
```

```ts filename="Button.stories.ts" renderer="react" language="ts-4-9" tabTitle="CSF 3"
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

```ts filename="Button.stories.ts" renderer="react" language="ts-4-9" tabTitle="CSF Factory 🧪"
// Learn about the # subpath import: https://storybook.js.org/docs/api/csf/csf-factories#subpath-imports
import preview from '#.storybook/preview';

import { Button } from './Button';

const meta = preview.meta({
  component: Button,
});

// Wrapped in light theme
export const Default = meta.story({});

// Wrapped in dark theme
export const Dark = meta.story({
  parameters: {
    theme: 'dark',
  },
});
```

```ts filename="Button.stories.ts" renderer="react" language="ts" tabTitle="CSF 3"
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

```ts filename="Button.stories.ts" renderer="react" language="ts" tabTitle="CSF Factory 🧪"
// Learn about the # subpath import: https://storybook.js.org/docs/api/csf/csf-factories#subpath-imports
import preview from '#.storybook/preview';

import { Button } from './Button';

const meta = preview.meta({
  component: Button,
});

// Wrapped in light theme
export const Default = meta.story({});

// Wrapped in dark theme
export const Dark = meta.story({
  parameters: {
    theme: 'dark',
  },
});
```
