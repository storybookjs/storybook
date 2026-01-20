```ts filename="components/MyComponent/MyComponent.stories.ts" renderer="angular" language="ts" tabTitle="CSF 3"
import type { Meta, StoryObj } from '@storybook/angular';

import { MyComponent } from './my-component.component';

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

export const Basic: Story = {
  args: {
    something: 'Something else',
  },
};
```

```ts filename="components/MyComponent/MyComponent.stories.ts" renderer="angular" language="ts" tabTitle="CSF Next 🧪"
import preview from '../.storybook/preview';

import { MyComponent } from './my-component.component';

const meta = preview.meta({
  /* 👇 The title prop is optional.
   * See https://storybook.js.org/docs/configure/#configure-story-loading
   * to learn how to generate automatic titles
   */
  component: MyComponent,
  title: 'components/MyComponent/MyComponent',
});

export const Basic = meta.story({
  args: {
    something: 'Something else',
  },
});
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

export const Basic = {
  args: {
    something: 'Something else',
  },
};
```

```js filename="components/MyComponent/MyComponent.stories.js|jsx" renderer="common" language="js" tabTitle="CSF 3"
import { MyComponent } from './MyComponent';

export default {
  component: MyComponent,
  title: 'components/MyComponent/MyComponent',
};

export const Basic = {
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

export const Basic: Story = {
  args: {
    something: 'Something else',
  },
};
```

```ts filename="components/MyComponent/MyComponent.stories.ts|tsx" renderer="common" language="ts" tabTitle="CSF 3"
// Replace your-framework with the framework you are using, e.g. react-vite, nextjs, vue3-vite, etc.
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

export const Basic: Story = {
  args: {
    something: 'Something else',
  },
};
```

```js filename="components/MyComponent/MyComponent.stories.js" renderer="web-components" language="js" tabTitle="CSF 3"
export default {
  component: 'my-component',
  title: 'components/MyComponent/MyComponent',
};

export const Basic = {
  args: {
    something: 'Something else',
  },
};
```

```ts filename="components/MyComponent/MyComponent.stories.ts" renderer="web-components" language="ts" tabTitle="CSF 3"
import type { Meta, StoryObj } from '@storybook/web-components-vite';

const meta: Meta = {
  component: 'my-component',
  title: 'components/MyComponent/MyComponent',
};

export default meta;
type Story = StoryObj;

export const Basic: Story = {
  args: {
    something: 'Something else',
  },
};
```

```js filename="components/MyComponent/MyComponent.stories.js" renderer="web-components" language="js" tabTitle="CSF Next 🧪"
import preview from '../.storybook/preview';

const meta = preview.meta({
  component: 'my-component',
  title: 'components/MyComponent/MyComponent',
});

export const Basic = meta.story({
  args: {
    something: 'Something else',
  },
});
```

```ts filename="components/MyComponent/MyComponent.stories.ts" renderer="web-components" language="ts" tabTitle="CSF Next 🧪"
import preview from '../.storybook/preview';

const meta = preview.meta({
  component: 'my-component',
  title: 'components/MyComponent/MyComponent',
});

export const Basic = meta.story({
  args: {
    something: 'Something else',
  },
});
```

```ts filename="components/MyComponent/MyComponent.stories.ts|tsx" renderer="react" language="ts" tabTitle="CSF Next 🧪"
import preview from '../.storybook/preview';

import { MyComponent } from './MyComponent';

const meta = preview.meta({
  /* 👇 The title prop is optional.
   * See https://storybook.js.org/docs/configure/#configure-story-loading
   * to learn how to generate automatic titles
   */
  component: MyComponent,
  title: 'components/MyComponent/MyComponent',
});

export const Basic = meta.story({
  args: {
    something: 'Something else',
  },
});
```

<!-- JS snippets still needed while providing both CSF 3 & Next -->

```js filename="components/MyComponent/MyComponent.stories.js|jsx" renderer="react" language="js" tabTitle="CSF Next 🧪"
import preview from '../.storybook/preview';
import { MyComponent } from './MyComponent';

const meta = preview.meta({
  component: MyComponent,
  title: 'components/MyComponent/MyComponent',
});

export const Basic = meta.story({
  args: {
    something: 'Something else',
  },
});
```
