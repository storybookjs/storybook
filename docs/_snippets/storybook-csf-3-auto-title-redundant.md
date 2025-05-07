```ts filename="components/MyComponent/MyComponent.stories.ts" renderer="angular" language="ts"
import type { Meta, StoryObj } from '@storybook/angular';

import { MyComponent } from './MyComponent.component';

const meta: Meta<MyComponent> = {
  /* 👇 The title prop is optional.
   * See https://storybook.js.org/docs/configure/#configure-story-loading
   * to learn how to generate automatic titles
   */
  component: MyComponent,
  title: 'components/MyComponent/MyComponent',
};

export default meta;
type Story = StoryObj<MyComponent>;

export const Default: Story = {
  args: {
    something: 'Something else',
  },
};
```

```svelte filename="components/MyComponent/MyComponent.stories.svelte" renderer="svelte" language="js" tabTitle="Svelte CSF"
<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf';

  import MyComponent from './MyComponent.svelte';

  const { Story } = defineMeta({
    component: MyComponent,
    title: 'components/MyComponent/MyComponent',
  });
</script>

<Story name="Default" args={{ something: 'Something else' }} />
```

```js filename="components/MyComponent/MyComponent.stories.js" renderer="svelte" language="js" tabTitle="CSF"
import MyComponent from './MyComponent.svelte';

export default {
  component: MyComponent,
  title: 'components/MyComponent/MyComponent',
};

export const Default = {
  args: {
    something: 'Something else',
  },
};
```

```js filename="components/MyComponent/MyComponent.stories.js|jsx" renderer="common" language="js"
import { MyComponent } from './MyComponent';

export default {
  component: MyComponent,
  title: 'components/MyComponent/MyComponent',
};

export const Default = {
  args: {
    something: 'Something else',
  },
};
```

```svelte filename="components/MyComponent/MyComponent.stories.svelte" renderer="svelte" language="ts" tabTitle="Svelte CSF"
<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf';

  import MyComponent from './MyComponent.svelte';

  const { Story } = defineMeta({
    component: MyComponent,
    title: 'components/MyComponent/MyComponent',
  });
</script>

<Story name="Default" args={{ something: 'Something else'}} />
```

```ts filename="components/MyComponent/MyComponent.stories.ts" renderer="svelte" language="ts" tabTitle="CSF"
// Replace your-framework with svelte-vite or sveltekit
import type { Meta, StoryObj } from '@storybook/your-framework';

import MyComponent from './MyComponent.svelte';

const meta = {
  /* 👇 The title prop is optional.
   * See https://storybook.js.org/docs/configure/#configure-story-loading
   * to learn how to generate automatic titles
   */
  component: MyComponent,
  title: 'components/MyComponent/MyComponent',
} satisfies Meta<typeof MyComponent>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    something: 'Something else',
  },
};
```

```ts filename="components/MyComponent/MyComponent.stories.ts|tsx" renderer="common" language="ts"
// Replace your-framework with the framework you are using (e.g., react-vite, vue3-vite, angular, etc.)
import type { Meta, StoryObj } from '@storybook/your-framework';

import { MyComponent } from './MyComponent';

const meta = {
  /* 👇 The title prop is optional.
   * See https://storybook.js.org/docs/configure/#configure-story-loading
   * to learn how to generate automatic titles
   */
  component: MyComponent,
  title: 'components/MyComponent/MyComponent',
} satisfies Meta<typeof MyComponent>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    something: 'Something else',
  },
};
```

```js filename="components/MyComponent/MyComponent.stories.js" renderer="web-components" language="js"
export default {
  component: 'my-component',
  title: 'components/MyComponent/MyComponent',
};

export const Default = {
  args: {
    something: 'Something else',
  },
};
```

```ts filename="components/MyComponent/MyComponent.stories.ts" renderer="web-components" language="ts"
import type { Meta, StoryObj } from '@storybook/web-components-vite';

const meta: Meta = {
  component: 'my-component',
  title: 'components/MyComponent/MyComponent',
};

export default meta;
type Story = StoryObj;

export const Default: Story = {
  args: {
    something: 'Something else',
  },
};
```
