```ts filename="MyComponent.stories.ts" renderer="angular" language="ts" tabTitle="CSF 4"
import preview from '../.storybook/preview';

import { MyComponent } from './my-component.component';

const meta = preview.meta({
  component: MyComponent,
});

export const Basic = meta.story();

export const WithProp = meta.story({
  render: () => ({
    props: {
      prop: 'value',
    },
  }),
});
```

```ts filename="MyComponent.stories.ts" renderer="angular" language="ts" tabTitle="CSF 3"
// ⚠️ CSF versions 1, 2, and 3 will be removed in a future version of Storybook. Upgrade to CSF 4: https://storybook.js.org/docs/writing-stories/csf#upgrade-to-csf-4
import type { Meta, StoryObj } from '@storybook/angular';

import { MyComponent } from './my-component.component';

const meta: Meta<MyComponent> = {
  component: MyComponent,
};

export default meta;
type Story = StoryObj<MyComponent>;

export const Basic: Story = {};

export const WithProp: Story = {
  render: () => ({
    props: {
      prop: 'value',
    },
  }),
};
```

```jsx filename="MyComponent.stories.js|jsx" renderer="react" language="js" tabTitle="CSF 4"
import preview from '../.storybook/preview';

import { MyComponent } from './MyComponent';

const meta = preview.meta({
  component: MyComponent,
});

export const Basic = meta.story();

export const WithProp = meta.story({
  render: () => <MyComponent prop="value" />,
});
```

```tsx filename="MyComponent.stories.ts|tsx" renderer="react" language="ts" tabTitle="CSF 4"
import preview from '../.storybook/preview';

import { MyComponent } from './MyComponent';

const meta = preview.meta({
  component: MyComponent,
});

export const Basic = meta.story();

export const WithProp = meta.story({
  render: () => <MyComponent prop="value" />,
});
```

```tsx filename="MyComponent.stories.ts|tsx" renderer="react" language="ts" tabTitle="CSF 3"
// ⚠️ CSF versions 1, 2, and 3 will be removed in a future version of Storybook. Upgrade to CSF 4: https://storybook.js.org/docs/writing-stories/csf#upgrade-to-csf-4
// Replace your-framework with the framework you are using, e.g. react-vite, nextjs, nextjs-vite, etc.
import type { Meta, StoryObj } from '@storybook/your-framework';

import { MyComponent } from './MyComponent';

const meta = {
  component: MyComponent,
} satisfies Meta<typeof MyComponent>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Basic: Story = {};

export const WithProp: Story = {
  render: () => <MyComponent prop="value" />,
};
```

```jsx filename="MyComponent.stories.js|jsx" renderer="react" language="js" tabTitle="CSF 3"
// ⚠️ CSF versions 1, 2, and 3 will be removed in a future version of Storybook. Upgrade to CSF 4: https://storybook.js.org/docs/writing-stories/csf#upgrade-to-csf-4
import { MyComponent } from './MyComponent';

export default {
  component: MyComponent,
};

export const Basic = {};

export const WithProp = {
  render: () => <MyComponent prop="value" />,
};
```

```jsx filename="MyComponent.story.js|jsx" renderer="solid" language="js"
import { MyComponent } from './MyComponent';

export default {
  component: MyComponent,
};

export const Basic = {};

export const WithProp = {
  render: () => <MyComponent prop="value" />,
};
```

```tsx filename="MyComponent.story.ts|tsx" renderer="solid" language="ts"
import type { Meta, StoryObj } from 'storybook-solidjs-vite';

import { MyComponent } from './MyComponent';

const meta = {
  component: MyComponent,
} satisfies Meta<typeof MyComponent>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Basic: Story = {};

export const WithProp: Story = {
  render: () => <MyComponent prop="value" />,
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

<Story name="Basic">
  <MyComponent />
</Story>

<Story name="WithProp">
  <MyComponent prop="value" />
</Story>
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

<Story name="Basic">
  <MyComponent />
</Story>

<Story name="WithProp">
  <MyComponent prop="value" />
</Story>
```

```svelte filename="MyComponent.stories.svelte" renderer="svelte" language="ts" tabTitle="CSF 4"
<script module lang="ts">
  import preview from '../.storybook/preview';

  import MyComponent from './MyComponent.svelte';

  const { Story } = preview.meta({
    component: MyComponent,
  });
</script>

<Story name="Basic">
  <MyComponent />
</Story>

<Story name="WithProp">
  <MyComponent prop="value" />
</Story>
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

<Story name="Basic">
  <MyComponent />
</Story>

<Story name="WithProp">
  <MyComponent prop="value" />
</Story>
```

```js filename="MyComponent.stories.js" renderer="vue" language="js" tabTitle="CSF 4"
import preview from '../.storybook/preview';

import MyComponent from './MyComponent.vue';

const meta = preview.meta({
  component: MyComponent,
});

export const Basic = meta.story({
  render: () => ({
    components: { MyComponent },
    template: '<MyComponent />',
  }),
});

export const WithProp = meta.story({
  render: () => ({
    components: { MyComponent },
    template: '<MyComponent prop="value" />',
  }),
});
```

```ts filename="MyComponent.stories.ts" renderer="vue" language="ts" tabTitle="CSF 4"
import preview from '../.storybook/preview';

import MyComponent from './MyComponent.vue';

const meta = preview.meta({
  component: MyComponent,
});

export const Basic = meta.story({
  render: () => ({
    components: { MyComponent },
    template: '<MyComponent />',
  }),
});

export const WithProp = meta.story({
  render: () => ({
    components: { MyComponent },
    template: '<MyComponent prop="value" />',
  }),
});
```

```ts filename="MyComponent.stories.ts" renderer="vue" language="ts" tabTitle="CSF 3"
// ⚠️ CSF versions 1, 2, and 3 will be removed in a future version of Storybook. Upgrade to CSF 4: https://storybook.js.org/docs/writing-stories/csf#upgrade-to-csf-4
import type { Meta, StoryObj } from '@storybook/vue3-vite';

import MyComponent from './MyComponent.vue';

const meta = {
  component: MyComponent,
} satisfies Meta<typeof MyComponent>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Basic: Story = {
  render: () => ({
    components: { MyComponent },
    template: '<MyComponent />',
  }),
};

export const WithProp: Story = {
  render: () => ({
    components: { MyComponent },
    template: '<MyComponent prop="value" />',
  }),
};
```

```js filename="MyComponent.stories.js" renderer="vue" language="js" tabTitle="CSF 3"
// ⚠️ CSF versions 1, 2, and 3 will be removed in a future version of Storybook. Upgrade to CSF 4: https://storybook.js.org/docs/writing-stories/csf#upgrade-to-csf-4
import MyComponent from './MyComponent.vue';

export default {
  component: MyComponent,
};

export const Basic = {
  render: () => ({
    components: { MyComponent },
    template: '<MyComponent />',
  }),
};

export const WithProp = {
  render: () => ({
    components: { MyComponent },
    template: '<MyComponent prop="value" />',
  }),
};
```

```js filename="MyComponent.stories.js" renderer="web-components" language="js" tabTitle="CSF 4"
import { html } from 'lit';

import preview from '../.storybook/preview';

const meta = preview.meta({
  component: 'my-component',
});

export const Basic = meta.story();

export const WithProp = meta.story({
  render: () => html`<my-component prop="value" />`,
});
```

```ts filename="MyComponent.stories.ts" renderer="web-components" language="ts" tabTitle="CSF 4"
import { html } from 'lit';

import preview from '../.storybook/preview';

const meta = preview.meta({
  component: 'my-component',
});

export const Basic = meta.story();

export const WithProp = meta.story({
  render: () => html`<my-component prop="value" />`,
});
```

```ts filename="MyComponent.stories.ts" renderer="web-components" language="ts" tabTitle="CSF 3"
// ⚠️ CSF versions 1, 2, and 3 will be removed in a future version of Storybook. Upgrade to CSF 4: https://storybook.js.org/docs/writing-stories/csf#upgrade-to-csf-4
import type { Meta, StoryObj } from '@storybook/web-components-vite';

import { html } from 'lit';

const meta: Meta = {
  component: 'my-component',
};

export default meta;
type Story = StoryObj;

export const Basic: Story = {};

export const WithProp: Story = {
  render: () => html`<my-component prop="value" />`,
};
```

```js filename="MyComponent.stories.js" renderer="web-components" language="js" tabTitle="CSF 3"
// ⚠️ CSF versions 1, 2, and 3 will be removed in a future version of Storybook. Upgrade to CSF 4: https://storybook.js.org/docs/writing-stories/csf#upgrade-to-csf-4
import { html } from 'lit';

export default {
  title: 'Path/To/MyComponent',
  component: 'my-component',
};

export const Basic = {};

export const WithProp = {
  render: () => html`<my-component prop="value" />`,
};
```
