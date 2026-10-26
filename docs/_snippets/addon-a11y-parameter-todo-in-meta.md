```ts filename="DataTable.stories.ts" renderer="angular" language="ts" tabTitle="CSF 4"
import preview from '../.storybook/preview';

import { DataTable } from './data-table.component';

const meta = preview.meta({
  component: DataTable,
  parameters: {
    // 👇 This component's accessibility tests will not fail
    //    Instead, they display warnings in the Storybook UI
    a11y: { test: 'todo' },
  },
});
```

```ts filename="DataTable.stories.ts" renderer="web-components" language="ts" tabTitle="CSF 4"
import preview from '../.storybook/preview';

const meta = preview.meta({
  component: 'demo-data-table',
  parameters: {
    // 👇 This component's accessibility tests will not fail
    //    Instead, they display warnings in the Storybook UI
    a11y: { test: 'todo' },
  },
});
```

```ts filename="DataTable.stories.ts" renderer="react" language="ts" tabTitle="CSF 4"
import preview from '../.storybook/preview';

import { DataTable } from './DataTable';

const meta = preview.meta({
  component: DataTable,
  parameters: {
    // 👇 This component's accessibility tests will not fail
    //    Instead, they display warnings in the Storybook UI
    a11y: { test: 'todo' },
  },
});
```

```js filename="DataTable.stories.js" renderer="web-components" language="js" tabTitle="CSF 4"
import preview from '../.storybook/preview';

const meta = preview.meta({
  component: 'demo-data-table',
  parameters: {
    // 👇 This component's accessibility tests will not fail
    //    Instead, they display warnings in the Storybook UI
    a11y: { test: 'todo' },
  },
});
```

```svelte filename="DataTable.stories.svelte" renderer="svelte" language="ts" tabTitle="CSF 4"
<script module lang="ts">
  import preview from '../.storybook/preview';

  import DataTable from './DataTable.svelte';

  const { Story } = preview.meta({
    component: DataTable,
    parameters: {
      // 👇 This component's accessibility tests will not fail
      //    Instead, they display warnings in the Storybook UI
      a11y: { test: 'todo' },
    },
  });
</script>
```

```svelte filename="DataTable.stories.svelte" renderer="svelte" language="ts" tabTitle="CSF 3"
<!-- ⚠️ CSF 3 is deprecated and will be removed in Storybook 12 -->
<script module>
  // Replace your-framework with the framework you are using, e.g. sveltekit or svelte-vite
  import { defineMeta } from '@storybook/your-framework';

  import DataTable from './DataTable.svelte';

  const { Story } = defineMeta({
    component: DataTable,
    parameters: {
      // 👇 This component's accessibility tests will not fail
      //    Instead, they display warnings in the Storybook UI
      a11y: { test: 'todo' },
    },
  });
</script>
```

```svelte filename="DataTable.stories.svelte" renderer="svelte" language="js" tabTitle="CSF 4"
<script module>
  import preview from '../.storybook/preview';

  import DataTable from './DataTable.svelte';

  const { Story } = preview.meta({
    component: DataTable,
    parameters: {
      // 👇 This component's accessibility tests will not fail
      //    Instead, they display warnings in the Storybook UI
      a11y: { test: 'todo' },
    },
  });
</script>
```

```svelte filename="DataTable.stories.svelte" renderer="svelte" language="js" tabTitle="CSF 3"
<!-- ⚠️ CSF 3 is deprecated and will be removed in Storybook 12 -->
<script module>
  // Replace your-framework with the framework you are using, e.g. sveltekit or svelte-vite
  import { defineMeta } from '@storybook/your-framework';

  import DataTable from './DataTable.svelte';

  const { Story } = defineMeta({
    component: DataTable,
    parameters: {
      // 👇 This component's accessibility tests will not fail
      //    Instead, they display warnings in the Storybook UI
      a11y: { test: 'todo' },
    },
  });
</script>
```

```ts filename="DataTable.stories.ts" renderer="vue" language="ts" tabTitle="CSF 4"
import preview from '../.storybook/preview';

import DataTable from './DataTable.vue';

const meta = preview.meta({
  component: DataTable,
  parameters: {
    // 👇 This component's accessibility tests will not fail
    //    Instead, they display warnings in the Storybook UI
    a11y: { test: 'todo' },
  },
});
```

```js filename="DataTable.stories.js" renderer="react" language="js" tabTitle="CSF 4"
import preview from '../.storybook/preview';

import { DataTable } from './DataTable';

const meta = preview.meta({
  component: DataTable,
  parameters: {
    // 👇 This component's accessibility tests will not fail
    //    Instead, they display warnings in the Storybook UI
    a11y: { test: 'todo' },
  },
});
```

```js filename="DataTable.stories.js" renderer="vue" language="js" tabTitle="CSF 4"
import preview from '../.storybook/preview';

import DataTable from './DataTable.vue';

const meta = preview.meta({
  component: DataTable,
  parameters: {
    // 👇 This component's accessibility tests will not fail
    //    Instead, they display warnings in the Storybook UI
    a11y: { test: 'todo' },
  },
});
```

```ts filename="DataTable.stories.ts" renderer="angular" language="ts" tabTitle="CSF 3"
// ⚠️ CSF versions 1, 2, and 3 will be removed in a future version of Storybook. Upgrade to CSF 4: https://storybook.js.org/docs/writing-stories/csf#upgrade-to-csf-4
import { Meta } from '@storybook/angular';

import { DataTable } from './data-table.component';

const meta: Meta<DataTable> = {
  component: DataTable,
  parameters: {
    // 👇 This component's accessibility tests will not fail
    //    Instead, they display warnings in the Storybook UI
    a11y: { test: 'todo' },
  },
};
export default meta;
```

```ts filename="DataTable.stories.ts" renderer="common" language="ts" tabTitle="CSF 3"
// ⚠️ CSF versions 1, 2, and 3 will be removed in a future version of Storybook. Upgrade to CSF 4: https://storybook.js.org/docs/writing-stories/csf#upgrade-to-csf-4
// Replace your-framework with the framework you are using, e.g. react-vite, nextjs, vue3-vite, etc.
import { Meta } from '@storybook/your-framework';

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

```js filename="DataTable.stories.js" renderer="common" language="js" tabTitle="CSF 3"
// ⚠️ CSF versions 1, 2, and 3 will be removed in a future version of Storybook. Upgrade to CSF 4: https://storybook.js.org/docs/writing-stories/csf#upgrade-to-csf-4
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

```ts filename="DataTable.stories.ts" renderer="web-components" language="ts" tabTitle="CSF 3"
// ⚠️ CSF versions 1, 2, and 3 will be removed in a future version of Storybook. Upgrade to CSF 4: https://storybook.js.org/docs/writing-stories/csf#upgrade-to-csf-4
import { Meta } from '@storybook/web-components-vite';

const meta: Meta<DataTable> = {
  component: 'demo-data-table',
  parameters: {
    // 👇 This component's accessibility tests will not fail
    //    Instead, they display warnings in the Storybook UI
    a11y: { test: 'todo' },
  },
};
export default meta;
```

```js filename="DataTable.stories.js" renderer="web-components" language="js" tabTitle="CSF 3"
// ⚠️ CSF versions 1, 2, and 3 will be removed in a future version of Storybook. Upgrade to CSF 4: https://storybook.js.org/docs/writing-stories/csf#upgrade-to-csf-4
export default {
  component: 'demo-data-table',
  parameters: {
    // 👇 This component's accessibility tests will not fail
    //    Instead, they display warnings in the Storybook UI
    a11y: { test: 'todo' },
  },
};
```
