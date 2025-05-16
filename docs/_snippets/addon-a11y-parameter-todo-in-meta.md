```ts filename="DataTable.stories.ts" renderer="common" language="ts"
// Replace your-framework with the framework you are using (e.g., react-vite, vue3-vite, angular, etc.)
import { Meta, StoryObj } from '@storybook/your-framework';

import { DataTable } from './DataTable';

const meta = {
  component: DataTable,
  parameters: {
    // 👇 This component's accessibility tests will not fail
    //    Instead, they display warnings in the Storybook UI
    a11y: { test: 'todo' },
  },
} satisfies Meta<typeof DataTable>;
export default meta;
```

```js filename="DataTable.stories.js" renderer="common" language="js"
import { DataTable } from './DataTable';

export default {
  component: DataTable,
  parameters: {
    // 👇 This component's accessibility tests will not fail
    //    Instead, they display warnings in the Storybook UI
    a11y: { test: 'todo' },
  },
};
```
