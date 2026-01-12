```svelte filename="MyComponent.stories.svelte" renderer="svelte" language="js" tabTitle="Svelte CSF"
<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf';

  import MyComponent from './MyComponent.svelte';

  const { Story } = defineMeta({
    component: MyComponent,
  });
</script>

<Story
  name="ExampleStory"
  args={{
    propertyA: import.meta.env.STORYBOOK_DATA_KEY,
    propertyB: import.meta.env.VITE_CUSTOM_VAR,
  }}
/>
```

```js filename="MyComponent.stories.js" renderer="svelte" language="js" tabTitle="CSF"
import MyComponent from './MyComponent.svelte';

export default {
  component: MyComponent,
};

export const ExampleStory = {
  args: {
    propertyA: import.meta.env.STORYBOOK_DATA_KEY,
    propertyB: import.meta.env.VITE_CUSTOM_VAR,
  },
};
```

```js filename="MyComponent.stories.js|jsx" renderer="common" language="js" tabTitle="CSF 3"
import { MyComponent } from './MyComponent';

export default {
  component: MyComponent,
};

export const ExampleStory = {
  args: {
    propertyA: import.meta.env.STORYBOOK_DATA_KEY,
    propertyB: import.meta.env.VITE_CUSTOM_VAR,
  },
};
```

```svelte filename="MyComponent.stories.svelte" renderer="svelte" language="ts" tabTitle="Svelte CSF"
<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf';

  import MyComponent from './MyComponent.svelte';

  const { Story } = defineMeta({
    component: MyComponent,
  });
</script>

<Story
  name="ExampleStory"
  args={{
    propertyA: import.meta.env.STORYBOOK_DATA_KEY,
    propertyB: import.meta.env.VITE_CUSTOM_VAR,
  }}
/>
```

```tsx filename="MyComponent.stories.ts" renderer="svelte" language="ts" tabTitle="CSF"
// Replace your-framework with svelte-vite or sveltekit
import type { Meta, StoryObj } from '@storybook/your-framework';

import MyComponent from './MyComponent.svelte';

const meta = {
  component: MyComponent,
} satisfies Meta<typeof MyComponent>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ExampleStory: Story = {
  args: {
    propertyA: import.meta.env.STORYBOOK_DATA_KEY,
    propertyB: import.meta.env.VITE_CUSTOM_VAR,
  },
};
```

```tsx filename="MyComponent.stories.ts|tsx" renderer="common" language="ts" tabTitle="CSF 3"
// Replace your-framework with the framework you are using, e.g. react-vite, nextjs, vue3-vite, etc.
import type { Meta, StoryObj } from '@storybook/your-framework';

import { MyComponent } from './MyComponent';

const meta = {
  component: MyComponent,
} satisfies Meta<typeof MyComponent>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ExampleStory: Story = {
  args: {
    propertyA: import.meta.env.STORYBOOK_DATA_KEY,
    propertyB: import.meta.env.VITE_CUSTOM_VAR,
  },
};
```

```js filename="MyComponent.stories.js" renderer="web-components" language="js"
export default {
  component: 'my-component',
};

export const ExampleStory = {
  args: {
    propertyA: import.meta.env.STORYBOOK_DATA_KEY,
    propertyB: import.meta.env.VITE_CUSTOM_VAR,
  },
};
```

```ts filename="MyComponent.stories.ts" renderer="web-components" language="ts"
import type { Meta, StoryObj } from '@storybook/web-components-vite';

const meta: Meta = {
  component: 'my-component',
};

export default meta;
type Story = StoryObj;

export const ExampleStory: Story = {
  args: {
    propertyA: import.meta.env.STORYBOOK_DATA_KEY,
    propertyB: import.meta.env.VITE_CUSTOM_VAR,
  },
};
```

```tsx filename="MyComponent.stories.ts|tsx" renderer="react" language="ts" tabTitle="CSF Next 🧪"
import preview from '../.storybook/preview';

import { MyComponent } from './MyComponent';

const meta = preview.meta({
  component: MyComponent,
});

export const ExampleStory = meta.story({
  args: {
    propertyA: import.meta.env.STORYBOOK_DATA_KEY,
    propertyB: import.meta.env.VITE_CUSTOM_VAR,
  },
});
```

<!-- JS snippets still needed while providing both CSF 3 & Next -->

```js filename="MyComponent.stories.js|jsx" renderer="react" language="js" tabTitle="CSF Next 🧪"
import preview from '../.storybook/preview';

import { MyComponent } from './MyComponent';

const meta = preview.meta({
  component: MyComponent,
});

export const ExampleStory = meta.story({
  args: {
    propertyA: import.meta.env.STORYBOOK_DATA_KEY,
    propertyB: import.meta.env.VITE_CUSTOM_VAR,
  },
});
```

```ts filename="MyComponent.stories.ts" renderer="vue" language="ts" tabTitle="CSF Next 🧪"
import preview from '../.storybook/preview';

import MyComponent from './MyComponent.vue';

const meta = preview.meta({
  component: MyComponent,
});

export const ExampleStory = meta.story({
  args: {
    propertyA: import.meta.env.STORYBOOK_DATA_KEY,
    propertyB: import.meta.env.VITE_CUSTOM_VAR,
  },
});
```

```js filename="MyComponent.stories.js" renderer="vue" language="js" tabTitle="CSF Next 🧪"
import preview from '../.storybook/preview';

import MyComponent from './MyComponent.vue';

const meta = preview.meta({
  component: MyComponent,
});

export const ExampleStory = meta.story({
  args: {
    propertyA: import.meta.env.STORYBOOK_DATA_KEY,
    propertyB: import.meta.env.VITE_CUSTOM_VAR,
  },
});
```
