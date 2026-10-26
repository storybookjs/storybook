```js filename="Button.stories.js" renderer="react" language="js" tabTitle="CSF 4"
import preview from '../.storybook/preview';

import { Button } from './Button';

const meta = preview.meta({
  component: Button,
});

// Wrapped in light theme
export const Basic = meta.story();

// Wrapped in dark theme
export const Dark = meta.story({
  parameters: {
    theme: 'dark',
  },
});
```

```ts filename="Button.stories.ts" renderer="react" language="ts" tabTitle="CSF 4"
import preview from '../.storybook/preview';

import { Button } from './Button';

const meta = preview.meta({
  component: Button,
});

// Wrapped in light theme
export const Basic = meta.story();

// Wrapped in dark theme
export const Dark = meta.story({
  parameters: {
    theme: 'dark',
  },
});
```

```ts filename="Button.stories.ts" renderer="react" language="ts" tabTitle="CSF 3"
// ⚠️ CSF versions 1, 2, and 3 will be removed in a future version of Storybook. Upgrade to CSF 4: https://storybook.js.org/docs/writing-stories/csf#upgrade-to-csf-4
// Replace your-framework with the framework you are using, e.g. react-vite, nextjs, nextjs-vite, etc.
import type { Meta, StoryObj } from '@storybook/your-framework';

import { Button } from './Button';

const meta = {
  component: Button,
} satisfies Meta<typeof Button>;
export default meta;

type Story = StoryObj<typeof meta>;

// Wrapped in light theme
export const Basic: Story = {};

// Wrapped in dark theme
export const Dark: Story = {
  parameters: {
    theme: 'dark',
  },
};
```

```js filename="Button.stories.js" renderer="react" language="js" tabTitle="CSF 3"
// ⚠️ CSF versions 1, 2, and 3 will be removed in a future version of Storybook. Upgrade to CSF 4: https://storybook.js.org/docs/writing-stories/csf#upgrade-to-csf-4
import { Button } from './Button';

export default {
  component: Button,
};

// Wrapped in light theme
export const Basic = {};

// Wrapped in dark theme
export const Dark = {
  parameters: {
    theme: 'dark',
  },
};
```
