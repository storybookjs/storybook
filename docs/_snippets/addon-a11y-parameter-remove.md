```ts filename="Button.stories.ts" renderer="common" language="ts"
// Replace your-renderer with the renderer you are using (e.g., react, vue3)
import { Meta } from '@storybook/your-renderer';

import { Button } from './Button';

const meta: Meta<typeof Button> = {
  component: Button,
  parameters: {
    // 👇 Remove this once all stories pass accessibility tests
    // a11y: { test: 'todo' },
  },
};
export default meta;
```

```js filename="Button.stories.js" renderer="common" language="ts-4-9"
// Replace your-renderer with the renderer you are using (e.g., react, vue3)
import { Meta, StoryObj } from '@storybook/your-renderer';

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
