```ts filename="MyComponent.stories.ts" renderer="angular" language="ts" tabTitle="CSF 4"
import preview from '../.storybook/preview';

import { MyComponent } from './my-component.component';

import someData from './data.json';

const meta = preview.meta({
  component: MyComponent,
  includeStories: ['SimpleStory', 'ComplexStory'], // 👈 Storybook loads these stories
  excludeStories: /.*Data$/, // 👈 Storybook ignores anything that contains Data
});

export const simpleData = { foo: 1, bar: 'baz' };
export const complexData = { foo: 1, foobar: { bar: 'baz', baz: someData } };

export const SimpleStory = meta.story({
  args: {
    data: simpleData,
  },
});

export const ComplexStory = meta.story({
  args: {
    data: complexData,
  },
});
```

```ts filename="MyComponent.stories.ts" renderer="angular" language="ts" tabTitle="CSF 3"
// ⚠️ CSF versions 1, 2, and 3 will be removed in a future version of Storybook. Upgrade to CSF 4: https://storybook.js.org/docs/writing-stories/csf#upgrade-to-csf-4
import type { Meta, StoryObj } from '@storybook/angular';

import { MyComponent } from './my-component.component';

import someData from './data.json';

const meta: Meta<MyComponent> = {
  component: MyComponent,
  includeStories: ['SimpleStory', 'ComplexStory'], // 👈 Storybook loads these stories
  excludeStories: /.*Data$/, // 👈 Storybook ignores anything that contains Data
};

export default meta;

export const simpleData = { foo: 1, bar: 'baz' };
export const complexData = { foo: 1, foobar: { bar: 'baz', baz: someData } };

type Story = StoryObj<MyComponent>;

export const SimpleStory: Story = {
  args: {
    data: simpleData,
  },
};

export const ComplexStory: Story = {
  args: {
    data: complexData,
  },
};
```

```jsx filename="MyComponent.stories.js|jsx" renderer="react" language="js" tabTitle="CSF 4"
import preview from '../.storybook/preview';

import { MyComponent } from './MyComponent';

import someData from './data.json';

const meta = preview.meta({
  component: MyComponent,
  includeStories: ['SimpleStory', 'ComplexStory'], // 👈 Storybook loads these stories
  excludeStories: /.*Data$/, // 👈 Storybook ignores anything that contains Data
});

export const simpleData = { foo: 1, bar: 'baz' };
export const complexData = { foo: 1, foobar: { bar: 'baz', baz: someData } };

export const SimpleStory = meta.story({
  args: {
    data: simpleData,
  },
});

export const ComplexStory = meta.story({
  args: {
    data: complexData,
  },
});
```

```tsx filename="MyComponent.stories.ts|tsx" renderer="react" language="ts" tabTitle="CSF 4"
import preview from '../.storybook/preview';

import { MyComponent } from './MyComponent';

import someData from './data.json';

const meta = preview.meta({
  component: MyComponent,
  includeStories: ['SimpleStory', 'ComplexStory'], // 👈 Storybook loads these stories
  excludeStories: /.*Data$/, // 👈 Storybook ignores anything that contains Data
});

export const simpleData = { foo: 1, bar: 'baz' };
export const complexData = { foo: 1, foobar: { bar: 'baz', baz: someData } };

export const SimpleStory = meta.story({
  args: {
    data: simpleData,
  },
});

export const ComplexStory = meta.story({
  args: {
    data: complexData,
  },
});
```

```ts filename="MyComponent.stories.ts|tsx" renderer="react" language="ts" tabTitle="CSF 3"
// ⚠️ CSF versions 1, 2, and 3 will be removed in a future version of Storybook. Upgrade to CSF 4: https://storybook.js.org/docs/writing-stories/csf#upgrade-to-csf-4
// Replace your-framework with the framework you are using, e.g. react-vite, nextjs, nextjs-vite, etc.
import type { Meta, StoryObj } from '@storybook/your-framework';

import { MyComponent } from './MyComponent';

import someData from './data.json';

const meta = {
  component: MyComponent,
  includeStories: ['SimpleStory', 'ComplexStory'], // 👈 Storybook loads these stories
  excludeStories: /.*Data$/, // 👈 Storybook ignores anything that contains Data
} satisfies Meta<typeof MyComponent>;

export default meta;
type Story = StoryObj<typeof meta>;

export const simpleData = { foo: 1, bar: 'baz' };
export const complexData = { foo: 1, foobar: { bar: 'baz', baz: someData } };

export const SimpleStory: Story = {
  args: {
    data: simpleData,
  },
};

export const ComplexStory: Story = {
  args: {
    data: complexData,
  },
};
```

```js filename="MyComponent.stories.js|jsx" renderer="react" language="js" tabTitle="CSF 3"
// ⚠️ CSF versions 1, 2, and 3 will be removed in a future version of Storybook. Upgrade to CSF 4: https://storybook.js.org/docs/writing-stories/csf#upgrade-to-csf-4
import { MyComponent } from './MyComponent';

import someData from './data.json';

export default {
  component: MyComponent,
  includeStories: ['SimpleStory', 'ComplexStory'], // 👈 Storybook loads these stories
  excludeStories: /.*Data$/, // 👈 Storybook ignores anything that contains Data
};

export const simpleData = { foo: 1, bar: 'baz' };
export const complexData = { foo: 1, foobar: { bar: 'baz', baz: someData } };

export const SimpleStory = {
  args: {
    data: simpleData,
  },
};

export const ComplexStory = {
  args: {
    data: complexData,
  },
};
```

```js filename="MyComponent.stories.js|jsx" renderer="solid" language="js"
import { MyComponent } from './MyComponent';

import someData from './data.json';

export default {
  component: MyComponent,
  includeStories: ['SimpleStory', 'ComplexStory'], // 👈 Storybook loads these stories
  excludeStories: /.*Data$/, // 👈 Storybook ignores anything that contains Data
};

export const simpleData = { foo: 1, bar: 'baz' };
export const complexData = { foo: 1, foobar: { bar: 'baz', baz: someData } };

export const SimpleStory = {
  args: {
    data: simpleData,
  },
};

export const ComplexStory = {
  args: {
    data: complexData,
  },
};
```

```tsx filename="MyComponent.stories.ts|tsx" renderer="solid" language="ts"
import type { Meta, StoryObj } from 'storybook-solidjs-vite';

import { MyComponent } from './MyComponent';

import someData from './data.json';

const meta = {
  component: MyComponent,
  includeStories: ['SimpleStory', 'ComplexStory'], // 👈 Storybook loads these stories
  excludeStories: /.*Data$/, // 👈 Storybook ignores anything that contains Data
} satisfies Meta<typeof MyComponent>;

export default meta;
type Story = StoryObj<typeof meta>;

export const simpleData = { foo: 1, bar: 'baz' };
export const complexData = { foo: 1, foobar: { bar: 'baz', baz: someData } };

export const SimpleStory: Story = {
  args: {
    data: simpleData,
  },
};

export const ComplexStory: Story = {
  args: {
    data: complexData,
  },
};
```

```svelte filename="MyComponent.stories.svelte" renderer="svelte" language="js" tabTitle="CSF 4"
<script module>
  import preview from '../.storybook/preview';

  import MyComponent from './MyComponent.svelte';

  import someData from './data.json';

  const { Story } = preview.meta({
    component: MyComponent,
    includeStories: ['SimpleStory', 'ComplexStory'], // 👈 Storybook loads these stories
    excludeStories: /.*Data$/, // 👈 Storybook ignores anything that contains Data
  });

  export const simpleData = { foo: 1, bar: 'baz' };

  export const complexData = { foo: 1, foobar: { bar: 'baz', baz: someData } };
</script>

<Story name="SimpleStory" args={{ data: simpleData }} />

<Story name="ComplexStory" args={{ data: complexData }} />
```

```svelte filename="MyComponent.stories.svelte" renderer="svelte" language="js" tabTitle="CSF 3"
<!-- ⚠️ CSF 3 is deprecated and will be removed in Storybook 12 -->
<script module>
  // Replace your-framework with the framework you are using, e.g. sveltekit or svelte-vite
  import { defineMeta } from '@storybook/your-framework';

  import MyComponent from './MyComponent.svelte';

  import someData from './data.json';

  const { Story } = defineMeta({
    component: MyComponent,
    includeStories: ['SimpleStory', 'ComplexStory'], // 👈 Storybook loads these stories
    excludeStories: /.*Data$/, // 👈 Storybook ignores anything that contains Data
  });

  export const simpleData = { foo: 1, bar: 'baz' };

  export const complexData = { foo: 1, foobar: { bar: 'baz', baz: someData } };
</script>

<Story name="SimpleStory" args={{ data: simpleData }} />

<Story name="ComplexStory" args={{ data: complexData }} />
```

```svelte filename="MyComponent.stories.svelte" renderer="svelte" language="ts" tabTitle="CSF 4"
<script module lang="ts">
  import preview from '../.storybook/preview';

  import MyComponent from './MyComponent.svelte';

  import someData from './data.json';

  const { Story } = preview.meta({
    component: MyComponent,
    includeStories: ['SimpleStory', 'ComplexStory'], // 👈 Storybook loads these stories
    excludeStories: /.*Data$/, // 👈 Storybook ignores anything that contains Data
  });

  export const simpleData = { foo: 1, bar: 'baz' };

  export const complexData = { foo: 1, foobar: { bar: 'baz', baz: someData } };
</script>

<Story name="SimpleStory" args={{ data: simpleData }} />

<Story name="ComplexStory" args={{ data: complexData }} />
```

```svelte filename="MyComponent.stories.svelte" renderer="svelte" language="ts" tabTitle="CSF 3"
<!-- ⚠️ CSF 3 is deprecated and will be removed in Storybook 12 -->
<script module>
  // Replace your-framework with the framework you are using, e.g. sveltekit or svelte-vite
  import { defineMeta } from '@storybook/your-framework';

  import MyComponent from './MyComponent.svelte';

  import someData from './data.json';

  const { Story } = defineMeta({
    component: MyComponent,
    includeStories: ['SimpleStory', 'ComplexStory'], // 👈 Storybook loads these stories
    excludeStories: /.*Data$/, // 👈 Storybook ignores anything that contains Data
  });

  export const simpleData = { foo: 1, bar: 'baz' };

  export const complexData = { foo: 1, foobar: { bar: 'baz', baz: someData } };
</script>

<Story name="SimpleStory" args={{ data: simpleData }} />

<Story name="ComplexStory" args={{ data: complexData }} />
```

```js filename="MyComponent.stories.js" renderer="vue" language="js" tabTitle="CSF 4"
import preview from '../.storybook/preview';

import MyComponent from './MyComponent.vue';

import someData from './data.json';

const meta = preview.meta({
  component: MyComponent,
  includeStories: ['SimpleStory', 'ComplexStory'],
  excludeStories: /.*Data$/, // 👈 Storybook ignores anything that contains Data
});

export const simpleData = { foo: 1, bar: 'baz' };
export const complexData = { foo: 1, foobar: { bar: 'baz', baz: someData } };

export const SimpleStory = meta.story({
  args: {
    data: simpleData,
  },
});

export const ComplexStory = meta.story({
  args: {
    data: complexData,
  },
});
```

```ts filename="MyComponent.stories.ts" renderer="vue" language="ts" tabTitle="CSF 4"
import preview from '../.storybook/preview';

import MyComponent from './MyComponent.vue';

import someData from './data.json';

const meta = preview.meta({
  component: MyComponent,
  includeStories: ['SimpleStory', 'ComplexStory'],
  excludeStories: /.*Data$/, // 👈 Storybook ignores anything that contains Data
});

export const simpleData = { foo: 1, bar: 'baz' };
export const complexData = { foo: 1, foobar: { bar: 'baz', baz: someData } };

export const SimpleStory = meta.story({
  args: {
    data: simpleData,
  },
});

export const ComplexStory = meta.story({
  args: {
    data: complexData,
  },
});
```

```ts filename="MyComponent.stories.ts" renderer="vue" language="ts" tabTitle="CSF 3"
// ⚠️ CSF versions 1, 2, and 3 will be removed in a future version of Storybook. Upgrade to CSF 4: https://storybook.js.org/docs/writing-stories/csf#upgrade-to-csf-4
import type { Meta, StoryObj } from '@storybook/vue3-vite';

import MyComponent from './MyComponent.vue';

import someData from './data.json';

const meta = {
  component: MyComponent,
  includeStories: ['SimpleStory', 'ComplexStory'],
  excludeStories: /.*Data$/, // 👈 Storybook ignores anything that contains Data
} satisfies Meta<typeof MyComponent>;

export const simpleData = { foo: 1, bar: 'baz' };
export const complexData = { foo: 1, foobar: { bar: 'baz', baz: someData } };

export default meta;
type Story = StoryObj<typeof meta>;

export const SimpleStory: Story = {
  args: {
    data: simpleData,
  },
};

export const ComplexStory: Story = {
  args: {
    data: complexData,
  },
};
```

```js filename="MyComponent.stories.js" renderer="vue" language="js" tabTitle="CSF 3"
// ⚠️ CSF versions 1, 2, and 3 will be removed in a future version of Storybook. Upgrade to CSF 4: https://storybook.js.org/docs/writing-stories/csf#upgrade-to-csf-4
import MyComponent from './MyComponent.vue';

import someData from './data.json';

export default {
  component: MyComponent,
  includeStories: ['SimpleStory', 'ComplexStory'],
  excludeStories: /.*Data$/, // 👈 Storybook ignores anything that contains Data
};

export const simpleData = { foo: 1, bar: 'baz' };
export const complexData = { foo: 1, foobar: { bar: 'baz', baz: someData } };

export const SimpleStory = {
  args: {
    data: simpleData,
  },
};

export const ComplexStory = {
  args: {
    data: complexData,
  },
};
```

```js filename="MyComponent.stories.js" renderer="web-components" language="js" tabTitle="CSF 4"
import preview from '../.storybook/preview';

const meta = preview.meta({
  component: 'my-component',
  includeStories: ['SimpleStory', 'ComplexStory'], // 👈 Storybook loads these stories
  excludeStories: /.*Data$/, // 👈 Storybook ignores anything that contains Data
});

export const simpleData = { foo: 1, bar: 'baz' };
export const complexData = { foo: 1, foobar: { bar: 'baz', baz: someData } };

export const SimpleStory = meta.story({
  args: {
    data: simpleData,
  },
});

export const ComplexStory = meta.story({
  args: {
    data: complexData,
  },
});
```

```ts filename="MyComponent.stories.ts" renderer="web-components" language="ts" tabTitle="CSF 4"
import preview from '../.storybook/preview';

const meta = preview.meta({
  component: 'my-component',
  includeStories: ['SimpleStory', 'ComplexStory'], // 👈 Storybook loads these stories
  excludeStories: /.*Data$/, // 👈 Storybook ignores anything that contains Data
});

export const simpleData = { foo: 1, bar: 'baz' };
export const complexData = { foo: 1, foobar: { bar: 'baz', baz: someData } };

export const SimpleStory = meta.story({
  args: {
    data: simpleData,
  },
});

export const ComplexStory = meta.story({
  args: {
    data: complexData,
  },
});
```

```ts filename="MyComponent.stories.ts" renderer="web-components" language="ts" tabTitle="CSF 3"
// ⚠️ CSF versions 1, 2, and 3 will be removed in a future version of Storybook. Upgrade to CSF 4: https://storybook.js.org/docs/writing-stories/csf#upgrade-to-csf-4
import type { Meta, StoryObj } from '@storybook/web-components-vite';

const meta: Meta = {
  component: 'my-component',
  includeStories: ['SimpleStory', 'ComplexStory'], // 👈 Storybook loads these stories
  excludeStories: /.*Data$/, // 👈 Storybook ignores anything that contains Data
};

export const simpleData = { foo: 1, bar: 'baz' };
export const complexData = { foo: 1, foobar: { bar: 'baz', baz: someData } };

export default meta;
type Story = StoryObj;

export const SimpleStory: Story = {
  args: {
    data: simpleData,
  },
};

export const ComplexStory: Story = {
  args: {
    data: complexData,
  },
};
```

```js filename="MyComponent.stories.js" renderer="web-components" language="js" tabTitle="CSF 3"
// ⚠️ CSF versions 1, 2, and 3 will be removed in a future version of Storybook. Upgrade to CSF 4: https://storybook.js.org/docs/writing-stories/csf#upgrade-to-csf-4
export default {
  component: 'my-component',
  includeStories: ['SimpleStory', 'ComplexStory'], // 👈 Storybook loads these stories
  excludeStories: /.*Data$/, // 👈 Storybook ignores anything that contains Data
};

export const simpleData = { foo: 1, bar: 'baz' };
export const complexData = { foo: 1, foobar: { bar: 'baz', baz: someData } };

export const SimpleStory = {
  args: {
    data: simpleData,
  },
};

export const ComplexStory = {
  args: {
    data: complexData,
  },
};
```
