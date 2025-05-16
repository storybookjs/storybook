```ts filename="Button.stories.ts" renderer="common" language="ts"
// Replace your-framework with the framework you are using (e.g., react-vite, vue3-vite, angular, etc.)
import { Meta, StoryObj } from '@storybook/your-framework';

import { Button } from './Button';

const meta = {
  component: Button,
  parameters: {
    // 👇 Remove this once all stories pass accessibility tests
    // a11y: { test: 'todo' },
  },
} satisfies Meta<typeof Button>;
export default meta;
```

```js filename="Button.stories.js" renderer="common" language="js"
import { Button } from './Button';

export default {
  component: Button,
  parameters: {
    // 👇 Remove this once all stories pass accessibility tests
    // a11y: { test: 'todo' },
  },
};
```
