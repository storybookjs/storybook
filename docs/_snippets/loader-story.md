```ts filename="TodoItem.stories.ts" renderer="angular" language="ts" tabTitle="CSF 4"
import { CommonModule } from '@angular/common';

import { moduleMetadata } from '@storybook/angular';

import preview from '../.storybook/preview';

import { TodoItem } from './TodoItem.component';

const meta = preview.meta({
  component: TodoItem,
  decorators: [
    moduleMetadata({
      declarations: [TodoItem],
      imports: [CommonModule],
    }),
  ],
});

/*
 *👇 Render functions are a framework specific feature to allow you control on how the component renders.
 * See https://storybook.js.org/docs/api/csf
 * to learn how to use render functions.
 */
export const Primary = meta.story({
  render: (args, { loaded: { todo } }) => ({
    props: {
      args,
      todo,
    },
  }),
  loaders: [
    async () => ({
      todo: await (await fetch('https://jsonplaceholder.typicode.com/todos/1')).json(),
    }),
  ],
});
```

```ts filename="TodoItem.stories.ts" renderer="angular" language="ts" tabTitle="CSF 3"
// ⚠️ CSF versions 1, 2, and 3 will be removed in a future version of Storybook. Upgrade to CSF 4: https://storybook.js.org/docs/writing-stories/csf#upgrade-to-csf-4
import { type Meta, type StoryObj, moduleMetadata } from '@storybook/angular';

import { CommonModule } from '@angular/common';

import { TodoItem } from './TodoItem.component';

const meta: Meta<TodoItem> = {
  component: TodoItem,
  decorators: [
    moduleMetadata({
      declarations: [TodoItem],
      imports: [CommonModule],
    }),
  ],
};

export default meta;
type Story = StoryObj<TodoItem>;

/*
 *👇 Render functions are a framework specific feature to allow you control on how the component renders.
 * See https://storybook.js.org/docs/api/csf
 * to learn how to use render functions.
 */
export const Primary: Story = {
  render: (args, { loaded: { todo } }) => ({
    props: {
      args,
      todo,
    },
  }),
  loaders: [
    async () => ({
      todo: await (await fetch('https://jsonplaceholder.typicode.com/todos/1')).json(),
    }),
  ],
};
```

```jsx filename="TodoItem.stories.js|jsx" renderer="react" language="js" tabTitle="CSF 4"
import preview from '../.storybook/preview';

import { TodoItem } from './TodoItem';

const meta = preview.meta({
  component: TodoItem,
  render: (args, { loaded: { todo } }) => <TodoItem {...args} {...todo} />,
});

export const Primary = meta.story({
  loaders: [
    async () => ({
      todo: await (await fetch('https://jsonplaceholder.typicode.com/todos/1')).json(),
    }),
  ],
});
```

```tsx filename="MyComponent.stories.ts|tsx" renderer="react" language="ts" tabTitle="CSF 4"
import preview from '../.storybook/preview';

import { TodoItem } from './TodoItem';

/*
 *👇 Render functions are a framework specific feature to allow you control on how the component renders.
 * See https://storybook.js.org/docs/api/csf
 * to learn how to use render functions.
 */
const meta = preview.meta({
  component: TodoItem,
  render: (args, { loaded: { todo } }) => <TodoItem {...args} {...todo} />,
});

export const Primary = meta.story({
  loaders: [
    async () => ({
      todo: await (await fetch('https://jsonplaceholder.typicode.com/todos/1')).json(),
    }),
  ],
});
```

```jsx filename="TodoItem.stories.js|jsx" renderer="solid" language="js"
import { TodoItem } from './TodoItem';

/*
 *👇 Render functions are a framework specific feature to allow you control on how the component renders.
 * See https://storybook.js.org/docs/api/csf
 * to learn how to use render functions.
 */
export default {
  component: TodoItem,
  render: (args, { loaded: { todo } }) => <TodoItem {...args} {...todo} />,
};

export const Primary = {
  loaders: [
    async () => ({
      todo: await (await fetch('https://jsonplaceholder.typicode.com/todos/1')).json(),
    }),
  ],
};
```

```tsx filename="MyComponent.stories.ts|tsx" renderer="solid" language="ts"
import type { Meta, StoryObj } from 'storybook-solidjs-vite';

import { TodoItem } from './TodoItem';

/*
 *👇 Render functions are a framework specific feature to allow you control on how the component renders.
 * See https://storybook.js.org/docs/api/csf
 * to learn how to use render functions.
 */
const meta = {
  component: TodoItem,
  render: (args, { loaded: { todo } }) => <TodoItem {...args} {...todo} />,
} satisfies Meta<typeof TodoItem>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Primary: Story = {
  loaders: [
    async () => ({
      todo: await (await fetch('https://jsonplaceholder.typicode.com/todos/1')).json(),
    }),
  ],
};
```

```svelte filename="TodoItem.stories.svelte" renderer="svelte" language="js" tabTitle="CSF 4"
<script module>
  import preview from '../.storybook/preview';

  import TodoItem from './TodoItem.svelte';

  const { Story } = preview.meta({
    component: TodoItem,
    render: template,
  });
</script>

{#snippet template(args, { loaded: { todo } })}
  <TodoItem {...args} {...todo} />
{/snippet}

<Story
  name="Primary"
  loaders={[
    async () => ({
      todo: await (
        await fetch('https://jsonplaceholder.typicode.com/todos/1')
      ).json(),
    }),
  ]}
/>
```

```svelte filename="TodoItem.stories.svelte" renderer="svelte" language="js" tabTitle="CSF 3"
<!-- ⚠️ CSF 3 is deprecated and will be removed in Storybook 12 -->
<script module>
  // Replace your-framework with the framework you are using, e.g. sveltekit or svelte-vite
  import { defineMeta } from '@storybook/your-framework';

  import TodoItem from './TodoItem.svelte';

  const { Story } = defineMeta({
    component: TodoItem,
    render: template,
  });
</script>

{#snippet template(args, { loaded: { todo } })}
  <TodoItem {...args} {...todo} />
{/snippet}

<Story
  name="Primary"
  loaders={[
    async () => ({
      todo: await (
        await fetch('https://jsonplaceholder.typicode.com/todos/1')
      ).json(),
    }),
  ]}
/>
```

```svelte filename="TodoItem.stories.svelte" renderer="svelte" language="ts" tabTitle="CSF 4"
<script module lang="ts">
  import preview from '../.storybook/preview';

  import TodoItem from './TodoItem.svelte';

  const { Story } = preview.meta({
    component: TodoItem,
    render: template,
  });
</script>

{#snippet template(args, { loaded: { todo } })}
  <TodoItem {...args} {...todo} />
{/snippet}

<Story
  name="Primary"
  loaders={[
    async () => ({
      todo: await (
        await fetch('https://jsonplaceholder.typicode.com/todos/1')
      ).json(),
    }),
  ]}
/>
```

```svelte filename="TodoItem.stories.svelte" renderer="svelte" language="ts" tabTitle="CSF 3"
<!-- ⚠️ CSF 3 is deprecated and will be removed in Storybook 12 -->
<script module>
  // Replace your-framework with the framework you are using, e.g. sveltekit or svelte-vite
  import { defineMeta } from '@storybook/your-framework';

  import TodoItem from './TodoItem.svelte';

  const { Story } = defineMeta({
    component: TodoItem,
    render: template,
  });
</script>

{#snippet template(args, { loaded: { todo } })}
  <TodoItem {...args} {...todo} />
{/snippet}

<Story
  name="Primary"
  loaders={[
    async () => ({
      todo: await (
        await fetch('https://jsonplaceholder.typicode.com/todos/1')
      ).json(),
    }),
  ]}
/>
```

```js filename="TodoItem.stories.js" renderer="vue" language="js" tabTitle="CSF 4"
import preview from '../.storybook/preview';

import TodoItem from './TodoItem.vue';

const meta = preview.meta({
  component: TodoItem,
});

/*
 *👇 Render functions are a framework specific feature to allow you control on how the component renders.
 * See https://storybook.js.org/docs/api/csf
 * to learn how to use render functions.
 */
export const Primary = meta.story({
  render: (args, { loaded: { todo } }) => ({
    components: { TodoItem },
    setup() {
      return { args, todo: todo };
    },
    template: '<TodoItem :todo="todo" />',
  }),
  loaders: [
    async () => ({
      todo: await (await fetch('https://jsonplaceholder.typicode.com/todos/1')).json(),
    }),
  ],
});
```

```ts filename="TodoItem.stories.ts" renderer="vue" language="ts" tabTitle="CSF 4"
import preview from '../.storybook/preview';

import TodoItem from './TodoItem.vue';

const meta = preview.meta({
  component: TodoItem,
});

/*
 *👇 Render functions are a framework specific feature to allow you control on how the component renders.
 * See https://storybook.js.org/docs/api/csf
 * to learn how to use render functions.
 */
export const Primary = meta.story({
  render: (args, { loaded: { todo } }) => ({
    components: { TodoItem },
    setup() {
      return { args, todo: todo };
    },
    template: '<TodoItem :todo="todo" />',
  }),
  loaders: [
    async () => ({
      todo: await (await fetch('https://jsonplaceholder.typicode.com/todos/1')).json(),
    }),
  ],
});
```

```ts filename="TodoItem.stories.ts" renderer="vue" language="ts" tabTitle="CSF 3"
// ⚠️ CSF versions 1, 2, and 3 will be removed in a future version of Storybook. Upgrade to CSF 4: https://storybook.js.org/docs/writing-stories/csf#upgrade-to-csf-4
import type { Meta, StoryObj } from '@storybook/vue3-vite';

import TodoItem from './TodoItem.vue';

const meta = {
  component: TodoItem,
} satisfies Meta<typeof TodoItem>;

export default meta;
type Story = StoryObj<typeof meta>;

/*
 *👇 Render functions are a framework specific feature to allow you control on how the component renders.
 * See https://storybook.js.org/docs/api/csf
 * to learn how to use render functions.
 */
export const Primary: Story = {
  render: (args, { loaded: { todo } }) => ({
    components: { TodoItem },
    setup() {
      return { args, todo: todo };
    },
    template: '<TodoItem :todo="todo" />',
  }),
  loaders: [
    async () => ({
      todo: await (await fetch('https://jsonplaceholder.typicode.com/todos/1')).json(),
    }),
  ],
};
```

```js filename="TodoItem.stories.js" renderer="vue" language="js" tabTitle="CSF 3"
// ⚠️ CSF versions 1, 2, and 3 will be removed in a future version of Storybook. Upgrade to CSF 4: https://storybook.js.org/docs/writing-stories/csf#upgrade-to-csf-4
import TodoItem from './TodoItem.vue';

export default {
  component: TodoItem,
};

/*
 *👇 Render functions are a framework specific feature to allow you control on how the component renders.
 * See https://storybook.js.org/docs/api/csf
 * to learn how to use render functions.
 */
export const Primary = {
  render: (args, { loaded: { todo } }) => ({
    components: { TodoItem },
    setup() {
      return { args, todo: todo };
    },
    template: '<TodoItem :todo="todo" />',
  }),
  loaders: [
    async () => ({
      todo: await (await fetch('https://jsonplaceholder.typicode.com/todos/1')).json(),
    }),
  ],
};
```

```js filename="TodoItem.stories.js" renderer="web-components" language="js" tabTitle="CSF 4"
import { html } from 'lit';

import preview from '../.storybook/preview';

/*
 *👇 Render functions are a framework specific feature to allow you control on how the component renders.
 * See https://storybook.js.org/docs/api/csf
 * to learn how to use render functions.
 */
const meta = preview.meta({
  component: 'demo-todo-item',
  render: (args, { loaded: { todo } }) =>
    html`<demo-todo-item title=${todo.title} ?completed=${todo.completed}></demo-todo-item>`,
});

export const Primary = meta.story({
  loaders: [
    async () => ({
      todo: await (await fetch('https://jsonplaceholder.typicode.com/todos/1')).json(),
    }),
  ],
});
```

```ts filename="TodoItem.stories.ts" renderer="web-components" language="ts" tabTitle="CSF 4"
import { html } from 'lit';

import preview from '../.storybook/preview';

/*
 *👇 Render functions are a framework specific feature to allow you control on how the component renders.
 * See https://storybook.js.org/docs/api/csf
 * to learn how to use render functions.
 */
const meta = preview.meta({
  component: 'demo-todo-item',
  render: (args, { loaded: { todo } }) =>
    html`<demo-todo-item title=${todo.title} ?completed=${todo.completed}></demo-todo-item>`,
});

export const Primary = meta.story({
  loaders: [
    async () => ({
      todo: await (await fetch('https://jsonplaceholder.typicode.com/todos/1')).json(),
    }),
  ],
});
```

```ts filename="TodoItem.stories.ts" renderer="web-components" language="ts" tabTitle="CSF 3"
// ⚠️ CSF versions 1, 2, and 3 will be removed in a future version of Storybook. Upgrade to CSF 4: https://storybook.js.org/docs/writing-stories/csf#upgrade-to-csf-4
import type { Meta, StoryObj } from '@storybook/web-components-vite';

import { html } from 'lit';

/*
 *👇 Render functions are a framework specific feature to allow you control on how the component renders.
 * See https://storybook.js.org/docs/api/csf
 * to learn how to use render functions.
 */
const meta: Meta = {
  component: 'demo-todo-item',
  render: (args, { loaded: { todo } }) =>
    html`<demo-todo-item title=${todo.title} ?completed=${todo.completed}></demo-todo-item>`,
};

export default meta;
type Story = StoryObj;

export const Primary: Story = {
  loaders: [
    async () => ({
      todo: await (await fetch('https://jsonplaceholder.typicode.com/todos/1')).json(),
    }),
  ],
};
```

```js filename="TodoItem.stories.js" renderer="web-components" language="js" tabTitle="CSF 3"
// ⚠️ CSF versions 1, 2, and 3 will be removed in a future version of Storybook. Upgrade to CSF 4: https://storybook.js.org/docs/writing-stories/csf#upgrade-to-csf-4
import { html } from 'lit';

/*
 *👇 Render functions are a framework specific feature to allow you control on how the component renders.
 * See https://storybook.js.org/docs/api/csf
 * to learn how to use render functions.
 */
export default {
  component: 'demo-todo-item',
  render: (args, { loaded: { todo } }) =>
    html`<demo-todo-item title=${todo.title} ?completed=${todo.completed}></demo-todo-item>`,
};

export const Primary = {
  loaders: [
    async () => ({
      todo: await (await fetch('https://jsonplaceholder.typicode.com/todos/1')).json(),
    }),
  ],
};
```

```tsx filename="MyComponent.stories.ts|tsx" renderer="react" language="ts" tabTitle="CSF 3"
// ⚠️ CSF versions 1, 2, and 3 will be removed in a future version of Storybook. Upgrade to CSF 4: https://storybook.js.org/docs/writing-stories/csf#upgrade-to-csf-4
// Replace your-framework with the framework you are using, e.g. react-vite, nextjs, nextjs-vite, etc.
import type { Meta, StoryObj } from '@storybook/your-framework';

import { TodoItem } from './TodoItem';

/*
 *👇 Render functions are a framework specific feature to allow you control on how the component renders.
 * See https://storybook.js.org/docs/api/csf
 * to learn how to use render functions.
 */
const meta = {
  component: TodoItem,
  render: (args, { loaded: { todo } }) => <TodoItem {...args} {...todo} />,
} satisfies Meta<typeof TodoItem>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Primary: Story = {
  loaders: [
    async () => ({
      todo: await (await fetch('https://jsonplaceholder.typicode.com/todos/1')).json(),
    }),
  ],
};
```

```jsx filename="TodoItem.stories.js|jsx" renderer="react" language="js" tabTitle="CSF 3"
// ⚠️ CSF versions 1, 2, and 3 will be removed in a future version of Storybook. Upgrade to CSF 4: https://storybook.js.org/docs/writing-stories/csf#upgrade-to-csf-4
import { TodoItem } from './TodoItem';

/*
 *👇 Render functions are a framework specific feature to allow you control on how the component renders.
 * See https://storybook.js.org/docs/api/csf
 * to learn how to use render functions.
 */
export default {
  component: TodoItem,
  render: (args, { loaded: { todo } }) => <TodoItem {...args} {...todo} />,
};

export const Primary = {
  loaders: [
    async () => ({
      todo: await (await fetch('https://jsonplaceholder.typicode.com/todos/1')).json(),
    }),
  ],
};
```
