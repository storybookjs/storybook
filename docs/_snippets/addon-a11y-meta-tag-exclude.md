```ts filename="DataGrid.stories.ts" renderer="angular" language="ts"
import type { Meta } from '@storybook/angular/';

import { DataGrid } from './dataGrid.component';

const meta: Meta<DataGrid> = {
  component: DataGrid,
  // 👇 Remove the a11y-test tag for this component's stories
  tags: ['!a11y-test'],
};

export default meta;
```

```js filename="DataGrid.stories.js" renderer="html" language="js"
export default {
  // 👇 Remove the a11y-test tag for this component's stories
  tags: ['!a11y-test'],
};
```

```js filename="DataGrid.stories.js|jsx" renderer="common" language="js"
import { DataGrid } from './DataGrid';

export default {
  component: DataGrid,
  // 👇 Remove the a11y-test tag for this component's stories
  tags: ['!a11y-test'],
};
```

```ts filename="DataGrid.stories.ts|tsx" renderer="common" language="ts-4-9"
// Replace your-renderer with the renderer you are using (e.g., react, vue3)
import { Meta } from '@storybook/your-renderer';

import { DataGrid } from './DataGrid';

const meta = {
  component: DataGrid,
  // 👇 Remove the a11y-test tag for this component's stories
  tags: ['!a11y-test'],
} satisfies Meta<typeof DataGrid>;

export default meta;
```

```ts filename="DataGrid.stories.ts|tsx" renderer="common" language="ts"
// Replace your-renderer with the renderer you are using (e.g., react, vue3)
import { Meta } from '@storybook/your-renderer';

import { DataGrid } from './DataGrid';

const meta: Meta<typeof DataGrid> = {
  component: DataGrid,
  // 👇 Remove the a11y-test tag for this component's stories
  tags: ['!a11y-test'],
};

export default meta;
```

```js filename="DataGrid.stories.js|jsx" renderer="solid" language="js"
import { DataGrid } from './DataGrid';

export default {
  component: DataGrid,
  // 👇 Remove the a11y-test tag for this component's stories
  tags: ['!a11y-test'],
};
```

```tsx filename="DataGrid.stories.ts|tsx" renderer="solid" language="ts-4-9"
import type { Meta } from 'storybook-solidjs';

import { DataGrid } from './DataGrid';

const meta = {
  component: DataGrid,
  // 👇 Remove the a11y-test tag for this component's stories
  tags: ['!a11y-test'],
} satisfies Meta<typeof DataGrid>;

export default meta;
```

```tsx filename="DataGrid.stories.ts|tsx" renderer="solid" language="ts"
import type { Meta } from 'storybook-solidjs';

import { DataGrid } from './DataGrid';

const meta: Meta<typeof DataGrid> = {
  component: DataGrid,
  // 👇 Remove the a11y-test tag for this component's stories
  tags: ['!a11y-test'],
};

export default meta;
```

```svelte filename="DataGrid.stories.svelte" renderer="svelte" language="js" tabTitle="Svelte CSF"
<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf';

  import DataGrid from './DataGrid.svelte';

  const { Story } = defineMeta({
    component: DataGrid,
    // 👇 Remove the a11y-test tag for this component's stories
    tags: ['!a11y-test'],
  });
</script>
```

```js filename="DataGrid.stories.js" renderer="svelte" language="js" tabTitle="CSF"
import DataGrid from './DataGrid.svelte';

export default {
  component: DataGrid,
  // 👇 Remove the a11y-test tag for this component's stories
  tags: ['!a11y-test'],
};
```

```svelte filename="DataGrid.stories.svelte" renderer="svelte" language="ts-4-9" tabTitle="Svelte CSF"
<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf';

  import DataGrid from './DataGrid.svelte';

  const { Story } = defineMeta({
    component: DataGrid,
    // 👇 Remove the a11y-test tag for this component's stories
    tags: ['!a11y-test'],
  });
</script>
```

```ts filename="DataGrid.stories.ts" renderer="svelte" language="ts-4-9" tabTitle="CSF"
import type { Meta } from '@storybook/svelte';

import DataGrid from './DataGrid.svelte';

const meta = {
  component: DataGrid,
  // 👇 Remove the a11y-test tag for this component's stories
  tags: ['!a11y-test'],
} satisfies Meta<typeof DataGrid>;

export default meta;
```

```svelte filename="DataGrid.stories.svelte" renderer="svelte" language="ts" tabTitle="Svelte CSF"
<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf';

  import DataGrid from './DataGrid.svelte';

  const { Story } = defineMeta({
    component: DataGrid,
    // 👇 Remove the a11y-test tag for this component's stories
    tags: ['!a11y-test'],
  });
</script>
```

```ts filename="DataGrid.stories.ts" renderer="svelte" language="ts" tabTitle="CSF"
import type { Meta } from '@storybook/svelte';

import DataGrid from './DataGrid.svelte';

const meta: Meta<typeof DataGrid> = {
  component: DataGrid,
  // 👇 Remove the a11y-test tag for this component's stories
  tags: ['!a11y-test'],
};

export default meta;
```

```js filename="DataGrid.stories.js" renderer="vue" language="js"
import DataGrid from './DataGrid.vue';

export default {
  component: DataGrid,
  // 👇 Remove the a11y-test tag for this component's stories
  tags: ['!a11y-test'],
};
```

```ts filename="DataGrid.stories.ts" renderer="vue" language="ts-4-9"
import type { Meta, StoryObj } from '@storybook/vue3';

import DataGrid from './DataGrid.vue';

const meta = {
  component: DataGrid,
  // 👇 Remove the a11y-test tag for this component's stories
  tags: ['!a11y-test'],
} satisfies Meta<typeof DataGrid>;

export default meta;
```

```ts filename="DataGrid.stories.ts" renderer="vue" language="ts"
import type { Meta, StoryObj } from '@storybook/vue3';

import DataGrid from './DataGrid.vue';

const meta: Meta<typeof DataGrid> = {
  component: DataGrid,
  // 👇 Remove the a11y-test tag for this component's stories
  tags: ['!a11y-test'],
};

export default meta;
```

```js filename="DataGrid.stories.js" renderer="web-components" language="js"
export default {
  component: 'demo-dataGrid',
  // 👇 Remove the a11y-test tag for this component's stories
  tags: ['!a11y-test'],
};
```

```ts filename="DataGrid.stories.ts" renderer="web-components" language="ts"
import type { Meta, StoryObj } from '@storybook/web-components';

const meta: Meta = {
  component: 'demo-dataGrid',
  // 👇 Remove the a11y-test tag for this component's stories
  tags: ['!a11y-test'],
};

export default meta;
```
