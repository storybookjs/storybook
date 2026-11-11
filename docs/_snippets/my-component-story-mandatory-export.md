```ts filename="MyComponent.stories.ts" renderer="angular" language="ts" tabTitle="CSF 3"
// ⚠️ CSF versions 1, 2, and 3 will be removed in a future version of Storybook. Upgrade to CSF 4: https://storybook.js.org/docs/writing-stories/csf#upgrade-to-csf-4
import type { Meta } from '@storybook/angular';

import { MyComponent } from './my-component.component';

const meta: Meta<MyComponent> = {
  /* 👇 The title prop is optional.
   * See https://storybook.js.org/docs/configure/#configure-story-loading
   * to learn how to generate automatic titles
   */
  title: 'Path/To/MyComponent',
  component: MyComponent,
  decorators: [/* ... */],
  parameters: {/* ... */},
};

export default meta;
```

```svelte filename="MyComponent.stories.svelte" renderer="svelte" language="js" tabTitle="CSF 4"
<script module>
  import preview from '../.storybook/preview';

  import MyComponent from './MyComponent.svelte';

  const { Story } = preview.meta({
    /* 👇 The title prop is optional.
     * See https://storybook.js.org/docs/configure/#configure-story-loading
     * to learn how to generate automatic titles
     */
    title: 'Path/To/MyComponent',
    component: MyComponent,
    decorators: [
      /* ... */
    ],
    parameters: {
      /* ... */
    },
  });
</script>
```

```svelte filename="MyComponent.stories.svelte" renderer="svelte" language="js" tabTitle="CSF 3"
<!-- ⚠️ CSF versions 1, 2, and 3 will be removed in a future version of Storybook. Upgrade to CSF 4: https://storybook.js.org/docs/writing-stories/csf#upgrade-to-csf-4 -->
<script module>
  // Replace your-framework with the framework you are using, e.g. sveltekit or svelte-vite
  import { defineMeta } from '@storybook/your-framework';

  import MyComponent from './MyComponent.svelte';

  const { Story } = defineMeta({
    /* 👇 The title prop is optional.
     * See https://storybook.js.org/docs/configure/#configure-story-loading
     * to learn how to generate automatic titles
     */
    title: 'Path/To/MyComponent',
    component: MyComponent,
    decorators: [
      /* ... */
    ],
    parameters: {
      /* ... */
    },
  });
</script>
```

```js filename="MyComponent.story.js|jsx" renderer="common" language="js"
import { MyComponent } from './MyComponent';

export default {
  /* 👇 The title prop is optional.
   * See https://storybook.js.org/docs/configure/#configure-story-loading
   * to learn how to generate automatic titles
   */
  title: 'Path/To/MyComponent',
  component: MyComponent,
  decorators: [/* ... */],
  parameters: {/* ... */},
};
```

```svelte filename="MyComponent.stories.svelte" renderer="svelte" language="ts" tabTitle="CSF 4"
<script module lang="ts">
  import preview from '../.storybook/preview';

  import MyComponent from './MyComponent.svelte';

  const { Story } = preview.meta({
    /* 👇 The title prop is optional.
     * See https://storybook.js.org/docs/configure/#configure-story-loading
     * to learn how to generate automatic titles
     */
    title: 'Path/To/MyComponent',
    component: MyComponent,
    decorators: [
      /* ... */
    ],
    parameters: {
      /* ... */
    },
  });
</script>
```

```svelte filename="MyComponent.stories.svelte" renderer="svelte" language="ts" tabTitle="CSF 3"
<!-- ⚠️ CSF versions 1, 2, and 3 will be removed in a future version of Storybook. Upgrade to CSF 4: https://storybook.js.org/docs/writing-stories/csf#upgrade-to-csf-4 -->
<script module>
  // Replace your-framework with the framework you are using, e.g. sveltekit or svelte-vite
  import { defineMeta } from '@storybook/your-framework';

  import MyComponent from './MyComponent.svelte';

  const { Story } = defineMeta({
    /* 👇 The title prop is optional.
     * See https://storybook.js.org/docs/configure/#configure-story-loading
     * to learn how to generate automatic titles
     */
    title: 'Path/To/MyComponent',
    component: MyComponent,
    decorators: [
      /* ... */
    ],
    parameters: {
      /* ... */
    },
  });
</script>
```

```ts filename="MyComponent.stories.ts|tsx" renderer="common" language="ts"
// Replace your-framework with the framework you are using, e.g. react-vite, nextjs, vue3-vite, etc.
import type { Meta } from '@storybook/your-framework';

import { MyComponent } from './MyComponent';

const meta = {
  /* 👇 The title prop is optional.
   * See https://storybook.js.org/docs/configure/#configure-story-loading
   * to learn how to generate automatic titles
   */
  title: 'Path/To/MyComponent',
  component: MyComponent,
  decorators: [/* ... */],
  parameters: {/* ... */},
} satisfies Meta<typeof MyComponent>;

export default meta;
```

```js filename="MyComponent.stories.js" renderer="web-components" language="js"
export default {
  title: 'Path/To/MyComponent',
  component: 'my-component',
  decorators: [/* ... */],
  parameters: {/* ... */},
};
```

```ts filename="MyComponent.stories.ts" renderer="web-components" language="ts"
import type { Meta } from '@storybook/web-components-vite';

const meta: Meta = {
  title: 'Path/To/MyComponent',
  component: 'my-component',
  decorators: [/* ... */],
  parameters: {/* ... */},
};

export default meta;
```
