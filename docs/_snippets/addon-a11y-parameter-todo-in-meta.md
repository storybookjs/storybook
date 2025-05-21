```ts filename="DataTable.stories.ts" renderer="common" language="ts"
// Replace your-renderer with the renderer you are using (e.g., react, vue3)
import { Meta } from '@storybook/your-renderer';

import { DataTable } from './DataTable';

const meta: Meta<typeof DataTable> = {
  component: DataTable,
  parameters: {
    // 👇 This component's accessibility tests will not fail
    //    Instead, they display warnings in the Storybook UI
    a11y: { test: 'todo' },
  },
};
export default meta;
```

```js filename="DataTable.stories.js" renderer="common" language="ts-4-9"
// Replace your-renderer with the renderer you are using (e.g., react, vue3)
import { Meta, StoryObj } from '@storybook/your-renderer';

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
