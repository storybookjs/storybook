```ts filename="Button.stories.ts" renderer="common" language="ts"
// Replace your-framework with the framework you are using (e.g., react-vite, vue3-vite, angular, etc.)
import { Meta, StoryObj } from '@storybook/your-framework';

import { Button } from './Button';

const meta = {
  component: Button,
  parameters: {
    // 👇 Applies to all stories in this file
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
    // 👇 Applies to all stories in this file
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
