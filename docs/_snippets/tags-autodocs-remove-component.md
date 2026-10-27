```ts filename="Page.stories.ts" renderer="angular" language="ts" tabTitle="CSF 3"
import type { Meta } from '@storybook/angular';

import { Page } from './Page.component';

const meta: Meta<Page> = {
  component: Page,
  // 👇 Disable auto-generated documentation for this component
  tags: ['!autodocs'],
};
export default meta;
```

```ts filename="Page.stories.ts" renderer="angular" language="ts" tabTitle="CSF Next 🧪"
import preview from '../.storybook/preview';

import { Page } from './Page.component';

const meta = preview.meta({
  component: Page,
  // 👇 Disable auto-generated documentation for this component
  tags: ['!autodocs'],
});
```

```svelte filename="Page.stories.svelte" renderer="svelte" language="js" tabTitle="Svelte CSF"
<script module>
  // Replace your-framework with the framework you are using, e.g. sveltekit or svelte-vite
  import { defineMeta } from '@storybook/your-framework';

  import Page from './Page.svelte';

  const { Story } = defineMeta({
    component: Page,
    // 👇 Disable auto-generated documentation for this component
    tags: ['!autodocs'],
  });
</script>
```

```svelte filename="Page.stories.svelte" renderer="svelte" language="js" tabTitle="Svelte CSF Next 🧪"
<script module>
  import preview from '../.storybook/preview';

  import Page from './Page.svelte';

  const { Story } = preview.meta({
    component: Page,
    // 👇 Disable auto-generated documentation for this component
    tags: ['!autodocs'],
  });
</script>
```

```js filename="Page.stories.js" renderer="common" language="js" tabTitle="CSF 3"
import { Page } from './Page';

export default {
  component: Page,
  // 👇 Disable auto-generated documentation for this component
  tags: ['!autodocs'],
};
```

```svelte filename="Page.stories.svelte" renderer="svelte" language="ts" tabTitle="Svelte CSF"
<script module>
  // Replace your-framework with the framework you are using, e.g. sveltekit or svelte-vite
  import { defineMeta } from '@storybook/your-framework';

  import Page from './Page.svelte';

  const { Story } = defineMeta({
    component: Page,
    // 👇 Disable auto-generated documentation for this component
    tags: ['!autodocs'],
  });
</script>
```

```svelte filename="Page.stories.svelte" renderer="svelte" language="ts" tabTitle="Svelte CSF Next 🧪"
<script module lang="ts">
  import preview from '../.storybook/preview';

  import Page from './Page.svelte';

  const { Story } = preview.meta({
    component: Page,
    // 👇 Disable auto-generated documentation for this component
    tags: ['!autodocs'],
  });
</script>
```

```ts filename="Page.stories.ts" renderer="common" language="ts" tabTitle="CSF 3"
// Replace your-framework with the framework you are using, e.g. react-vite, nextjs, vue3-vite, etc.
import type { Meta } from '@storybook/your-framework';

import { Page } from './Page';

const meta = {
  component: Page,
  // 👇 Disable auto-generated documentation for this component
  tags: ['!autodocs'],
} satisfies Meta<typeof Page>;
export default meta;
```

```js filename="Page.stories.js" renderer="web-components" language="js" tabTitle="CSF 3"
export default {
  title: 'Page',
  component: 'demo-page',
  // 👇 Disable auto-generated documentation for this component
  tags: ['!autodocs'],
};
```

```ts filename="Page.stories.ts" renderer="web-components" language="ts" tabTitle="CSF 3"
import type { Meta } from '@storybook/web-components-vite';

const meta: Meta = {
  title: 'Page',
  component: 'demo-page',
  // 👇 Disable auto-generated documentation for this component
  tags: ['!autodocs'],
};
export default meta;
```

```ts filename="Page.stories.ts" renderer="web-components" language="ts" tabTitle="CSF Next 🧪"
import preview from '../.storybook/preview';

const meta = preview.meta({
  component: 'demo-page',
  // 👇 Disable auto-generated documentation for this component
  tags: ['!autodocs'],
});
```

```js filename="Page.stories.js" renderer="web-components" language="js" tabTitle="CSF Next 🧪"
import preview from '../.storybook/preview';

const meta = preview.meta({
  component: 'demo-page',
  // 👇 Disable auto-generated documentation for this component
  tags: ['!autodocs'],
});
```

```ts filename="Page.stories.ts" renderer="react" language="ts" tabTitle="CSF Next 🧪"
import preview from '../.storybook/preview';

import { Page } from './Page';

const meta = preview.meta({
  component: Page,
  // 👇 Disable auto-generated documentation for this component
  tags: ['!autodocs'],
});
```

<!-- JS snippets still needed while providing both CSF 3 & Next -->

```js filename="Page.stories.js" renderer="react" language="js" tabTitle="CSF Next 🧪"
import preview from '../.storybook/preview';

import { Page } from './Page';

const meta = preview.meta({
  component: Page,
  // 👇 Disable auto-generated documentation for this component
  tags: ['!autodocs'],
});
```

```ts filename="Page.stories.ts" renderer="vue" language="ts" tabTitle="CSF Next 🧪"
import preview from '../.storybook/preview';

import Page from './Page.vue';

const meta = preview.meta({
  component: Page,
  // 👇 Disable auto-generated documentation for this component
  tags: ['!autodocs'],
});
```

<!-- JS snippets still needed while providing both CSF 3 & Next -->

```js filename="Page.stories.js" renderer="vue" language="js" tabTitle="CSF Next 🧪"
import preview from '../.storybook/preview';

import Page from './Page.vue';

const meta = preview.meta({
  component: Page,
  // 👇 Disable auto-generated documentation for this component
  tags: ['!autodocs'],
});
```
