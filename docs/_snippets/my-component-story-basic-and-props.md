```ts filename="MyComponent.stories.ts" renderer="angular" language="ts"
import type { Meta, StoryObj } from '@storybook/angular';

import { MyComponent } from './MyComponent.component';

const meta: Meta<MyComponent> = {
  component: MyComponent,
};

export default meta;
type Story = StoryObj<MyComponent>;

export const Default: Story = {};

export const WithProp: Story = {
  render: () => ({
    props: {
      prop: 'value',
    },
  }),
};
```

```js filename="MyComponent.stories.js|jsx" renderer="react" language="js"
import { MyComponent } from './MyComponent';

export default {
  component: MyComponent,
};

export const Basic = {};

export const WithProp = {
  render: () => <MyComponent prop="value" />,
};
```

```tsx filename="MyComponent.stories.ts|tsx" renderer="react" language="ts-4-9"
import type { Meta, StoryObj } from '@storybook/react';

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

```tsx filename="MyComponent.stories.ts|tsx" renderer="react" language="ts"
import type { Meta, StoryObj } from '@storybook/react';

import { MyComponent } from './MyComponent';

const meta: Meta<typeof MyComponent> = {
  component: MyComponent,
};

export default meta;
type Story = StoryObj<typeof MyComponent>;

export const Basic: Story = {};

export const WithProp: Story = {
  render: () => <MyComponent prop="value" />,
};
```

```js filename="MyComponent.story.js|jsx" renderer="solid" language="js"
import { MyComponent } from './MyComponent';

export default {
  component: MyComponent,
};

export const Basic = {};

export const WithProp = {
  render: () => <MyComponent prop="value" />,
};
```

```tsx filename="MyComponent.story.ts|tsx" renderer="solid" language="ts-4-9"
import type { Meta, StoryObj } from 'storybook-solidjs';

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

```tsx filename="MyComponent.story.ts|tsx" renderer="solid" language="ts"
import type { Meta, StoryObj } from 'storybook-solidjs';

import { MyComponent } from './MyComponent';

const meta: Meta<typeof MyComponent> = {
  component: MyComponent,
};

export default meta;
type Story = StoryObj<typeof MyComponent>;

export const Basic: Story = {};

export const WithProp: Story = {
  render: () => <MyComponent prop="value" />,
};
```

```svelte filename="MyComponent.stories.svelte" renderer="svelte" language="js" tabTitle="Svelte CSF"
<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf';

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

```js filename="MyComponent.stories.js" renderer="svelte" language="js" tabTitle="CSF"
import MyComponent from './MyComponent.svelte';

export default {
  component: MyComponent,
};

export const Basic = {};

/*
 *👇 Render functions are a framework specific feature to allow you control on how the component renders.
 * See https://storybook.js.org/docs/api/csf
 * to learn how to use render functions.
 */
export const WithProp = {
  render: () => ({
    Component: MyComponent,
    props: {
      prop: 'value',
    },
  }),
};
```

```svelte filename="MyComponent.stories.svelte" renderer="svelte" language="ts-4-9" tabTitle="Svelte CSF"
<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf';

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

```ts filename="MyComponent.stories.ts" renderer="svelte" language="ts-4-9" tabTitle="CSF"
import type { Meta, StoryObj } from '@storybook/svelte';

import MyComponent from './MyComponent.svelte';

const meta = {
  component: MyComponent,
} satisfies Meta<typeof MyComponent>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Basic: Story = {};

/*
 *👇 Render functions are a framework specific feature to allow you control on how the component renders.
 * See https://storybook.js.org/docs/api/csf
 * to learn how to use render functions.
 */
export const WithProp: Story = {
  render: () => ({
    Component: MyComponent,
    props: {
      prop: 'value',
    },
  }),
};
```

```svelte filename="MyComponent.stories.svelte" renderer="svelte" language="ts-4-9" tabTitle="Svelte CSF"
<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf';

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

```ts filename="MyComponent.stories.ts" renderer="svelte" language="ts" tabTitle="CSF"
import type { Meta, StoryObj } from '@storybook/svelte';

import MyComponent from './MyComponent.svelte';

const meta: Meta<typeof MyComponent> = {
  component: MyComponent,
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Basic: Story = {};

/*
 *👇 Render functions are a framework specific feature to allow you control on how the component renders.
 * See https://storybook.js.org/docs/api/csf
 * to learn how to use render functions.
 */
export const WithProp: Story = {
  render: () => ({
    Component: MyComponent,
    props: {
      prop: 'value',
    },
  }),
};
```

```js filename="MyComponent.stories.js" renderer="vue" language="js"
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
    template: '<MyComponent prop="value"/>',
  }),
};
```

```ts filename="MyComponent.stories.ts" renderer="vue" language="ts-4-9"
import type { Meta, StoryObj } from '@storybook/vue3';

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
    template: '<MyComponent prop="value"/>',
  }),
};
```

```ts filename="MyComponent.stories.ts" renderer="vue" language="ts"
import type { Meta, StoryObj } from '@storybook/vue3';

import MyComponent from './MyComponent.vue';

const meta: Meta<typeof MyComponent> = {
  component: MyComponent,
};

export default meta;
type Story = StoryObj<typeof MyComponent>;

export const Basic: Story = {
  render: () => ({
    components: { MyComponent },
    template: '<MyComponent />',
  }),
};

export const WithProp: Story = {
  render: () => ({
    components: { MyComponent },
    template: '<MyComponent prop="value"/>',
  }),
};
```

```js filename="MyComponent.stories.js" renderer="web-components" language="js"
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

```ts filename="MyComponent.stories.ts" renderer="web-components" language="ts"
import type { Meta, StoryObj } from '@storybook/web-components';

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
