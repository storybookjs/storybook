```ts filename="MyComponent.stories.ts" renderer="angular" language="ts" tabTitle="CSF 4"
import preview from '../.storybook/preview';

import { MyComponent } from './my-component.component';

// More on default export: https://storybook.js.org/docs/writing-stories/#default-export
const meta = preview.meta({
  component: MyComponent,
});

export const Example = meta.story({
  parameters: {
    design: {
      type: 'figma',
      url: 'https://www.figma.com/file/Sample-File',
    },
  },
});
```

```ts filename="MyComponent.stories.ts" renderer="angular" language="ts" tabTitle="CSF 3"
// ⚠️ CSF versions 1, 2, and 3 will be removed in a future version of Storybook. Upgrade to CSF 4: https://storybook.js.org/docs/writing-stories/csf#upgrade-to-csf-4
import type { Meta, StoryObj } from '@storybook/angular';

import { MyComponent } from './my-component.component';

// More on default export: https://storybook.js.org/docs/writing-stories/#default-export
const meta: Meta<MyComponent> = {
  component: MyComponent,
};

export default meta;
type Story = StoryObj<MyComponent>;

export const Example: Story = {
  parameters: {
    design: {
      type: 'figma',
      url: 'https://www.figma.com/file/Sample-File',
    },
  },
};
```

```js filename="MyComponent.stories.js|jsx" renderer="react" language="js" tabTitle="CSF 4"
import preview from '../.storybook/preview';

import { MyComponent } from './MyComponent';

const meta = preview.meta({
  component: MyComponent,
});

export const Example = meta.story({
  parameters: {
    design: {
      type: 'figma',
      url: 'https://www.figma.com/file/Sample-File',
    },
  },
});
```

```ts filename="MyComponent.stories.ts|tsx" renderer="react" language="ts" tabTitle="CSF 4"
import preview from '../.storybook/preview';

import { MyComponent } from './MyComponent';

// More on default export: https://storybook.js.org/docs/writing-stories/#default-export
const meta = preview.meta({
  component: MyComponent,
});

export const Example = meta.story({
  parameters: {
    design: {
      type: 'figma',
      url: 'https://www.figma.com/file/Sample-File',
    },
  },
});
```

```js filename="MyComponent.stories.js|jsx" renderer="solid" language="js"
import { MyComponent } from './MyComponent';

export default {
  component: MyComponent,
};

export const Example = {
  parameters: {
    design: {
      type: 'figma',
      url: 'https://www.figma.com/file/Sample-File',
    },
  },
};
```

```tsx filename="MyComponent.stories.ts|tsx" renderer="solid" language="ts"
import type { Meta, StoryObj } from 'storybook-solidjs-vite';

import { MyComponent } from './MyComponent';

const meta = {
  component: MyComponent,
} satisfies Meta<typeof MyComponent>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Example: Story = {
  parameters: {
    design: {
      type: 'figma',
      url: 'https://www.figma.com/file/Sample-File',
    },
  },
};
```

```svelte filename="MyComponent.stories.svelte" renderer="svelte" language="js" tabTitle="CSF 4"
<script module>
  import preview from '../.storybook/preview';

  import MyComponent from './MyComponent.svelte';

  const { Story } = preview.meta({
    component: MyComponent,
  });
</script>

<Story
  name="Example"
  parameters={{
    design: {
      type: 'figma',
      url: 'https://www.figma.com/file/Sample-File',
    },
  }}
/>
```

```svelte filename="MyComponent.stories.svelte" renderer="svelte" language="js" tabTitle="CSF 3"
<!-- ⚠️ CSF 3 is deprecated and will be removed in Storybook 12 -->
<script module>
  // Replace your-framework with the framework you are using, e.g. sveltekit or svelte-vite
  import { defineMeta } from '@storybook/your-framework';

  import MyComponent from './MyComponent.svelte';

  const { Story } = defineMeta({
    component: MyComponent,
  });
</script>

<Story
  name="Example"
  parameters={{
    design: {
      type: 'figma',
      url: 'https://www.figma.com/file/Sample-File',
    },
  }}
/>
```

```svelte filename="MyComponent.stories.svelte" renderer="svelte" language="ts" tabTitle="CSF 4"
<script module lang="ts">
  import preview from '../.storybook/preview';

  import MyComponent from './MyComponent.svelte';

  const { Story } = preview.meta({
    component: MyComponent,
  });
</script>

<Story
  name="Example"
  parameters={{
    design: {
      type: 'figma',
      url: 'https://www.figma.com/file/Sample-File',
    },
  }}
/>
```

```svelte filename="MyComponent.stories.svelte" renderer="svelte" language="ts" tabTitle="CSF 3"
<!-- ⚠️ CSF 3 is deprecated and will be removed in Storybook 12 -->
<script module>
  // Replace your-framework with the framework you are using, e.g. sveltekit or svelte-vite
  import { defineMeta } from '@storybook/your-framework';

  import MyComponent from './MyComponent.svelte';

  const { Story } = defineMeta({
    component: MyComponent,
  });
</script>

<Story
  name="Example"
  parameters={{
    design: {
      type: 'figma',
      url: 'https://www.figma.com/file/Sample-File',
    },
  }}
/>
```

```js filename="MyComponent.stories.js" renderer="vue" language="js" tabTitle="CSF 4"
import preview from '../.storybook/preview';

import MyComponent from './MyComponent.vue';

// More on default export: https://storybook.js.org/docs/writing-stories/#default-export
const meta = preview.meta({
  component: MyComponent,
});

export const Example = meta.story({
  parameters: {
    design: {
      type: 'figma',
      url: 'https://www.figma.com/file/Sample-File',
    },
  },
});
```

```ts filename="MyComponent.stories.ts" renderer="vue" language="ts" tabTitle="CSF 4"
import preview from '../.storybook/preview';

import MyComponent from './MyComponent.vue';

// More on default export: https://storybook.js.org/docs/writing-stories/#default-export
const meta = preview.meta({
  component: MyComponent,
});

export const Example = meta.story({
  parameters: {
    design: {
      type: 'figma',
      url: 'https://www.figma.com/file/Sample-File',
    },
  },
});
```

```ts filename="MyComponent.stories.ts" renderer="vue" language="ts" tabTitle="CSF 3"
// ⚠️ CSF versions 1, 2, and 3 will be removed in a future version of Storybook. Upgrade to CSF 4: https://storybook.js.org/docs/writing-stories/csf#upgrade-to-csf-4
import type { Meta, StoryObj } from '@storybook/vue3-vite';

import MyComponent from './MyComponent.vue';

// More on default export: https://storybook.js.org/docs/writing-stories/#default-export
const meta = {
  component: MyComponent,
} satisfies Meta<typeof MyComponent>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Example: Story = {
  parameters: {
    design: {
      type: 'figma',
      url: 'https://www.figma.com/file/Sample-File',
    },
  },
};
```

```js filename="MyComponent.stories.js" renderer="vue" language="js" tabTitle="CSF 3"
// ⚠️ CSF versions 1, 2, and 3 will be removed in a future version of Storybook. Upgrade to CSF 4: https://storybook.js.org/docs/writing-stories/csf#upgrade-to-csf-4
import MyComponent from './MyComponent.vue';

// More on default export: https://storybook.js.org/docs/writing-stories/#default-export
export default {
  component: MyComponent,
};

export const Example = {
  parameters: {
    design: {
      type: 'figma',
      url: 'https://www.figma.com/file/Sample-File',
    },
  },
};
```

```js filename="MyComponent.stories.js" renderer="web-components" language="js" tabTitle="CSF 4"
import preview from '../.storybook/preview';

const meta = preview.meta({
  component: 'my-component',
});

export const Example = meta.story({
  parameters: {
    design: {
      type: 'figma',
      url: 'https://www.figma.com/file/Sample-File',
    },
  },
});
```

```ts filename="MyComponent.stories.ts" renderer="web-components" language="ts" tabTitle="CSF 4"
import preview from '../.storybook/preview';

const meta = preview.meta({
  component: 'my-component',
});

export const Example = meta.story({
  parameters: {
    design: {
      type: 'figma',
      url: 'https://www.figma.com/file/Sample-File',
    },
  },
});
```

```js filename="MyComponent.stories.js" renderer="web-components" language="js" tabTitle="CSF 3"
// ⚠️ CSF versions 1, 2, and 3 will be removed in a future version of Storybook. Upgrade to CSF 4: https://storybook.js.org/docs/writing-stories/csf#upgrade-to-csf-4
export default {
  component: 'my-component',
};

export const Example = {
  parameters: {
    design: {
      type: 'figma',
      url: 'https://www.figma.com/file/Sample-File',
    },
  },
};
```

```ts filename="MyComponent.stories.ts" renderer="web-components" language="ts" tabTitle="CSF 3"
// ⚠️ CSF versions 1, 2, and 3 will be removed in a future version of Storybook. Upgrade to CSF 4: https://storybook.js.org/docs/writing-stories/csf#upgrade-to-csf-4
import type { Meta, StoryObj } from '@storybook/web-components-vite';

const meta: Meta = {
  component: 'my-component',
};

export default meta;
type Story = StoryObj;

export const Example: Story = {
  parameters: {
    design: {
      type: 'figma',
      url: 'https://www.figma.com/file/Sample-File',
    },
  },
};
```

```ts filename="MyComponent.stories.ts|tsx" renderer="react" language="ts" tabTitle="CSF 3"
// ⚠️ CSF versions 1, 2, and 3 will be removed in a future version of Storybook. Upgrade to CSF 4: https://storybook.js.org/docs/writing-stories/csf#upgrade-to-csf-4
// Replace your-framework with the framework you are using, e.g. react-vite, nextjs, nextjs-vite, etc.
import type { Meta, StoryObj } from '@storybook/your-framework';

import { MyComponent } from './MyComponent';

// More on default export: https://storybook.js.org/docs/writing-stories/#default-export
const meta = {
  component: MyComponent,
} satisfies Meta<typeof MyComponent>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Example: Story = {
  parameters: {
    design: {
      type: 'figma',
      url: 'https://www.figma.com/file/Sample-File',
    },
  },
};
```

```js filename="MyComponent.stories.js|jsx" renderer="react" language="js" tabTitle="CSF 3"
// ⚠️ CSF versions 1, 2, and 3 will be removed in a future version of Storybook. Upgrade to CSF 4: https://storybook.js.org/docs/writing-stories/csf#upgrade-to-csf-4
import { MyComponent } from './MyComponent';

// More on default export: https://storybook.js.org/docs/writing-stories/#default-export
export default {
  component: MyComponent,
};

export const Example = {
  parameters: {
    design: {
      type: 'figma',
      url: 'https://www.figma.com/file/Sample-File',
    },
  },
};
```
