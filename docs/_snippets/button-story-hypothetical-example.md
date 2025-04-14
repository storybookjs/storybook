```js filename="Button.stories.js|jsx" renderer="common" language="js"
import { Button } from './Button';

export default {
  component: Button,
};

export const Sample = {
  render: () => ({
    template: '<button :label=label />',
    data: {
      label: 'hello button',
    },
  }),
};
```

```ts filename="Button.stories.ts|tsx" renderer="common" language="ts-4-9"
// Replace your-framework with the name of your framework
import type { Meta, StoryObj } from '@storybook/your-framework';

import { Button } from './Button';

const meta = {
  component: Button,
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Sample: Story = {
  render: () => ({
    template: '<button :label=label />',
    data: {
      label: 'hello button',
    },
  }),
};
```

```ts filename="Button.stories.ts|tsx" renderer="common" language="ts"
// Replace your-framework with the name of your framework
import type { Meta, StoryObj } from '@storybook/your-framework';

import { Button } from './Button';

const meta: Meta<typeof Button> = {
  component: Button,
};

export default meta;
type Story = StoryObj<typeof Button>;

export const Sample: Story = {
  render: () => ({
    template: '<button :label=label />',
    data: {
      label: 'hello button',
    },
  }),
};
```
