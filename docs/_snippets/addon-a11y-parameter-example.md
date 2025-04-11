```ts filename="Button.stories.ts" renderer="common" language="ts"
// Replace your-renderer with the renderer you are using (e.g., react, vue3)
import { Meta, StoryObj } from '@storybook/your-renderer';

import { Button } from './Button';

const meta: Meta<typeof Button> = {
  component: Button,
  parameters: {
    a11y: { test: 'error' },
  },
};
export default meta;

type Story = StoryObj<typeof Button>;

// 👇 This story will use the 'error' value and fail on accessibility violations
export const Primary: Story = {
  args: { primary: true },
};

// 👇 This story will not fail on accessibility violations
//    (but will still run the tests and show warnings)
export const NoA11yFail: Story = {
  parameters: {
    a11y: { test: 'todo' },
  },
};
```

```ts filename="Button.stories.ts" renderer="common" language="ts-4-9"
// Replace your-renderer with the renderer you are using (e.g., react, vue3)
import { Meta, StoryObj } from '@storybook/your-renderer';

import { Button } from './Button';

const meta = {
  component: Button,
  parameters: {
    a11y: { test: 'error' },
  },
} satisfies Meta<typeof Button>;
export default meta;

type Story = StoryObj<typeof meta>;

// 👇 This story will use the 'error' value and fail on accessibility violations
export const Primary: Story = {
  args: { primary: true },
};

// 👇 This story will not fail on accessibility violations
//    (but will still run the tests and show warnings)
export const NoA11yFail: Story = {
  parameters: {
    a11y: { test: 'todo' },
  },
};
```

```js filename="Button.stories.js" renderer="common" language="js"
import { Button } from './Button';

export default {
  component: Button,
  parameters: {
    a11y: { test: 'error' },
  },
};

// 👇 This story will use the 'error' value and fail on accessibility violations
export const Primary = {
  args: { primary: true },
};

// 👇 This story will not fail on accessibility violations
//    (but will still run the tests and show warnings)
export const NoA11yFail = {
  parameters: {
    a11y: { test: 'todo' },
  },
};
```
