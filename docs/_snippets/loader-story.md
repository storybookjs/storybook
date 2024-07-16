```ts filename="TodoItem.stories.ts" renderer="angular" language="ts"
import type { Meta, StoryObj } from '@storybook/angular';

import { moduleMetadata } from '@storybook/angular';

import { CommonModule } from '@angular/common';

import { TodoItem } from './TodoItem';

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

```js filename="TodoItem.stories.js|jsx" renderer="react" language="js"
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

```tsx filename="MyComponent.stories.ts|tsx" renderer="react" language="ts-4-9"
import type { Meta, StoryObj } from '@storybook/react';

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

```tsx filename="MyComponent.stories.ts|tsx" renderer="react" language="ts"
import type { Meta, StoryObj } from '@storybook/react';

import { TodoItem } from './TodoItem';

/*
 *👇 Render functions are a framework specific feature to allow you control on how the component renders.
 * See https://storybook.js.org/docs/api/csf
 * to learn how to use render functions.
 */
const meta: Meta<typeof TodoItem> = {
  component: TodoItem,
  render: (args, { loaded: { todo } }) => <TodoItem {...args} {...todo} />,
};

export default meta;
type Story = StoryObj<typeof TodoItem>;

export const Primary: Story = {
  loaders: [
    async () => ({
      todo: await (await fetch('https://jsonplaceholder.typicode.com/todos/1')).json(),
    }),
  ],
};
```

```js filename="TodoItem.stories.js|jsx" renderer="solid" language="js"
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

```tsx filename="MyComponent.stories.ts|tsx" renderer="solid" language="ts-4-9"
import type { Meta, StoryObj } from 'storybook-solidjs';

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

```tsx filename="MyComponent.stories.ts|tsx" renderer="solid" language="ts"
import type { Meta, StoryObj } from 'storybook-solidjs';

import { TodoItem } from './TodoItem';

/*
 *👇 Render functions are a framework specific feature to allow you control on how the component renders.
 * See https://storybook.js.org/docs/api/csf
 * to learn how to use render functions.
 */
const meta: Meta<typeof TodoItem> = {
  component: TodoItem,
  render: (args, { loaded: { todo } }) => <TodoItem {...args} {...todo} />,
};

export default meta;
type Story = StoryObj<typeof TodoItem>;

export const Primary: Story = {
  loaders: [
    async () => ({
      todo: await (await fetch('https://jsonplaceholder.typicode.com/todos/1')).json(),
    }),
  ],
};
```

```js filename="TodoItem.stories.js" renderer="svelte" language="js"
import TodoItem from './TodoItem.svelte';

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
    Component: TodoItem,
    props: {
      ...args,
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

```ts filename="TodoItem.stories.ts" renderer="svelte" language="ts-4-9"
import type { Meta, StoryObj } from '@storybook/svelte';

import TodoItem from './TodoItem.svelte';

/*
 *👇 Render functions are a framework specific feature to allow you control on how the component renders.
 * See https://storybook.js.org/docs/svelte/api/csf
 * to learn how to use render functions.
 */
const meta = {
  component: TodoItem,
  render: (args, { loaded: { todo } }) => ({
    Component: TodoItem,
    props: {
      ...args,
      ...todo,
    },
  }),
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

```ts filename="TodoItem.stories.ts" renderer="svelte" language="ts"
import type { Meta, StoryObj } from '@storybook/svelte';

import TodoItem from './TodoItem.svelte';

/*
 *👇 Render functions are a framework specific feature to allow you control on how the component renders.
 * See https://storybook.js.org/docs/svelte/api/csf
 * to learn how to use render functions.
 */
const meta: Meta<typeof TodoItem> = {
  component: TodoItem,
  render: (args, { loaded: { todo } }) => ({
    Component: TodoItem,
    props: {
      ...args,
      ...todo,
    },
  }),
};

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

```js filename="TodoItem.stories.js" renderer="vue" language="js"
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

```ts filename="TodoItem.stories.ts" renderer="vue" language="ts-4-9"
import type { Meta, StoryObj } from '@storybook/vue3';

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

```ts filename="TodoItem.stories.ts" renderer="vue" language="ts"
import type { Meta, StoryObj } from '@storybook/vue3';

import TodoItem from './TodoItem.vue';

const meta: Meta<typeof TodoItem> = {
  component: TodoItem,
};

export default meta;
type Story = StoryObj<typeof TodoItem>;

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

```js filename="TodoItem.stories.js" renderer="web-components" language="js"
/*
 *👇 Render functions are a framework specific feature to allow you control on how the component renders.
 * See https://storybook.js.org/docs/api/csf
 * to learn how to use render functions.
 */
export default {
  component: 'demo-todo-item',
  render: (args, { loaded: { todo } }) => TodoItem({ ...args, ...todo }),
};

export const Primary = {
  loaders: [
    async () => ({
      todo: await (await fetch('https://jsonplaceholder.typicode.com/todos/1')).json(),
    }),
  ],
};
```

```ts filename="TodoItem.stories.ts" renderer="web-components" language="ts"
import type { Meta, StoryObj } from '@storybook/web-components';

/*
 *👇 Render functions are a framework specific feature to allow you control on how the component renders.
 * See https://storybook.js.org/docs/api/csf
 * to learn how to use render functions.
 */
const meta: Meta = {
  component: 'demo-todo-item',
  render: (args, { loaded: { todo } }) => TodoItem({ ...args, ...todo }),
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

