```ts filename="Page.stories.ts" renderer="angular" language="ts"
import type { Meta } from '@storybook/angular';

import { Page } from './Page';

const meta: Meta<Page> = {
  component: Page,
  // 👇 Disable auto-generated documentation for this component
  tags: ['!autodocs'],
};
export default meta;
```

```svelte filename="Page.stories.svelte" renderer="svelte" language="js" tabTitle="Svelte CSF"
<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf';

  import Page from './Page.svelte';

  const { Story } = defineMeta({
    component: Page,
    // 👇 Disable auto-generated documentation for this component
    tags: ['!autodocs'],
  });
</script>
```

```js filename="Page.stories.js" renderer="svelte" language="js" tabTitle="CSF"
import Page from './Page.svelte';

export default {
  component: Page,
  // 👇 Disable auto-generated documentation for this component
  tags: ['!autodocs'],
};
```

```js filename="Page.stories.js" renderer="common" language="js"
import { Page } from './Page';

export default {
  component: Page,
  // 👇 Disable auto-generated documentation for this component
  tags: ['!autodocs'],
};
```

```svelte filename="Page.stories.svelte" renderer="svelte" language="ts-4-9" tabTitle="Svelte CSF"
<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf';

  import Page from './Page.svelte';

  const { Story } = defineMeta({
    component: Page,
    // 👇 Disable auto-generated documentation for this component
    tags: ['!autodocs'],
  });
</script>
```

```ts filename="Page.stories.ts" renderer="svelte" language="ts-4-9" tabTitle="CSF"
import type { Meta } from '@storybook/svelte';

import Page from './Page.svelte';

const meta = {
  component: Page,
  // 👇 Disable auto-generated documentation for this component
  tags: ['!autodocs'],
} satisfies Meta<typeof Page>;
export default meta;
```

```ts filename="Page.stories.ts" renderer="common" language="ts-4-9"
// Replace your-framework with the framework you are using (e.g., nextjs, vue3-vite)
import type { Meta } from '@storybook/your-framework';

import { Page } from './Page';

const meta = {
  component: Page,
  // 👇 Disable auto-generated documentation for this component
  tags: ['!autodocs'],
} satisfies Meta<typeof Page>;
export default meta;
```

```svelte filename="Page.stories.svelte" renderer="svelte" language="ts" tabTitle="Svelte CSF"
<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf';

  import Page from './Page.svelte';

  const { Story } = defineMeta({
    component: Page,
    // 👇 Disable auto-generated documentation for this component
    tags: ['!autodocs'],
  });
</script>
```

```ts filename="Page.stories.ts" renderer="svelte" language="ts" tabTitle="CSF"
import type { Meta } from '@storybook/svelte';

import Page from './Page.svelte';

const meta: Meta<typeof Page> = {
  component: Page,
  // 👇 Disable auto-generated documentation for this component
  tags: ['!autodocs'],
};
export default meta;
```

```ts filename="Page.stories.ts" renderer="common" language="ts"
// Replace your-framework with the framework you are using (e.g., nextjs, vue3-vite)
import type { Meta } from '@storybook/your-framework';

import { Page } from './Page';

const meta: Meta<typeof Page> = {
  component: Page,
  // 👇 Disable auto-generated documentation for this component
  tags: ['!autodocs'],
};
export default meta;
```

```js filename="Page.stories.js" renderer="web-components" language="js"
export default {
  title: 'Page',
  component: 'demo-page',
  // 👇 Disable auto-generated documentation for this component
  tags: ['!autodocs'],
};
```

```ts filename="Page.stories.ts" renderer="web-components" language="ts"
import type { Meta } from '@storybook/web-components';

const meta: Meta = {
  title: 'Page',
  component: 'demo-page',
  // 👇 Disable auto-generated documentation for this component
  tags: ['!autodocs'],
};
export default meta;
```
