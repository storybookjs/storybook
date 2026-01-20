```ts filename="List.stories.ts" renderer="angular" language="ts" tabTitle="CSF 3"
import { type Meta, type StoryObj, moduleMetadata } from '@storybook/angular';

import { CommonModule } from '@angular/common';

import { List } from './list.component';
import { ListItem } from './list-item.component';

//👇 Imports a specific story from ListItem stories
import { Unchecked } from './ListItem.stories';

const meta: Meta<List> = {
  component: List,
  decorators: [
    moduleMetadata({
      declarations: [List, ListItem],
      imports: [CommonModule],
    }),
  ],
};

export default meta;
type Story = StoryObj<List>;

/*
 *👇 Render functions are a framework specific feature to allow you control on how the component renders.
 * See https://storybook.js.org/docs/api/csf
 * to learn how to use render functions.
 */
const ListTemplate: Story = {
  render: (args) => ({
    props: args,
    template: `
      <app-list>
        <div *ngFor="let item of items">
          <app-list-item [item]="item"></app-list-item>
        </div>
      </app-list>
    `,
  }),
};

export const Empty: Story = {
  ...ListTemplate,
  args: { items: [] },
};

export const OneItem: Story = {
  ...ListTemplate,
  args: {
    items: [{ ...Unchecked.args }],
  },
};
```

```ts filename="List.stories.ts" renderer="angular" language="ts" tabTitle="CSF Next 🧪"
import { CommonModule } from '@angular/common';

import { moduleMetadata } from '@storybook/angular';

import preview from '../.storybook/preview';

import { List } from './list.component';
import { ListItem } from './list-item.component';

//👇 Imports a specific story from ListItem stories
import { Unchecked } from './ListItem.stories';

const meta = preview.meta({
  component: List,
  decorators: [
    moduleMetadata({
      declarations: [List, ListItem],
      imports: [CommonModule],
    }),
  ],
});

/*
 *👇 Render functions are a framework specific feature to allow you control on how the component renders.
 * See https://storybook.js.org/docs/api/csf
 * to learn how to use render functions.
 */
const ListTemplate = {
  render: (args) => ({
    props: args,
    template: `
      <app-list>
        <div *ngFor="let item of items">
          <app-list-item [item]="item"></app-list-item>
        </div>
      </app-list>
    `,
  }),
};

export const Empty = meta.story({
  ...ListTemplate,
  args: { items: [] },
});

export const OneItem = Empty.extend({
  args: {
    items: [{ ...Unchecked.input.args }],
  },
});
```

```jsx filename="List.stories.js|jsx" renderer="react" language="js" tabTitle="CSF 3"
import { List } from './List';
import { ListItem } from './ListItem';

//👇 Imports a specific story from ListItem stories
import { Unchecked } from './ListItem.stories';

export default {
  component: List,
};

//👇 The ListTemplate construct will be spread to the existing stories.
const ListTemplate = {
  render: ({ items, ...args }) => {
    return (
      <List>
        {items.map((item) => (
          <ListItem {...item} />
        ))}
      </List>
    );
  },
};

export const Empty = {
  ...ListTemplate,
  args: {
    items: [],
  },
};

export const OneItem = {
  ...ListTemplate,
  args: {
    items: [{ ...Unchecked.args }],
  },
};
```

```tsx filename="List.stories.ts|tsx" renderer="react" language="ts" tabTitle="CSF 3"
// Replace your-framework with the framework you are using, e.g. react-vite, nextjs, nextjs-vite, etc.
import type { Meta, StoryObj } from '@storybook/your-framework';

import { List } from './List';
import { ListItem } from './ListItem';

//👇 Imports a specific story from ListItem stories
import { Unchecked } from './ListItem.stories';

const meta = {
  component: List,
} satisfies Meta<typeof List>;

export default meta;
type Story = StoryObj<typeof meta>;

//👇 The ListTemplate construct will be spread to the existing stories.
const ListTemplate: Story = {
  render: ({ items, ...args }) => {
    return (
      <List>
        {items.map((item) => (
          <ListItem {...item} />
        ))}
      </List>
    );
  },
};

export const Empty = {
  ...ListTemplate,
  args: {
    items: [],
  },
};

export const OneItem = {
  ...ListTemplate,
  args: {
    items: [{ ...Unchecked.args }],
  },
};
```

```jsx filename="List.stories.js|jsx" renderer="solid" language="js"
import { List } from './List';
import { ListItem } from './ListItem';

//👇 Imports a specific story from ListItem stories
import { Unchecked } from './ListItem.stories';

export default {
  component: List,
};

//👇 The ListTemplate construct will be spread to the existing stories.
const ListTemplate = {
  render: ({ items, ...args }) => {
    return (
      <List>
        {items.map((item) => (
          <ListItem {...item} />
        ))}
      </List>
    );
  },
};

export const Empty = {
  ...ListTemplate,
  args: {
    items: [],
  },
};

export const OneItem = {
  ...ListTemplate,
  args: {
    items: [{ ...Unchecked.args }],
  },
};
```

```tsx filename="List.stories.ts|tsx" renderer="solid" language="ts"
import type { Meta, StoryObj } from 'storybook-solidjs-vite';

import { List } from './List';
import { ListItem } from './ListItem';

//👇 Imports a specific story from ListItem stories
import { Unchecked } from './ListItem.stories';

const meta = {
  component: List,
} satisfies Meta<typeof List>;

export default meta;
type Story = StoryObj<typeof meta>;

//👇 The ListTemplate construct will be spread to the existing stories.
const ListTemplate: Story = {
  render: ({ items, ...args }) => {
    return (
      <List>
        {items.map((item) => (
          <ListItem {...item} />
        ))}
      </List>
    );
  },
};

export const Empty = {
  ...ListTemplate,
  args: {
    items: [],
  },
};

export const OneItem = {
  ...ListTemplate,
  args: {
    items: [{ ...Unchecked.args }],
  },
};
```

```svelte filename="List.stories.svelte" renderer="svelte" language="js"
<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf';

  import List from './List.svelte';
  import ListItem from './ListItem.svelte';

  //👇 Imports a specific story from ListItem stories
  import { Unchecked } from './ListItem.stories.svelte';

  const { Story } = defineMeta({
    component: List,
  });
</script>

<!--
  The template construct will be spread to the existing stories.
  It's based on Svelte's snippet syntax allowing you share the same UI with small variations.
-->
{#snippet template(args)}
  <List {...args}>
    {#each args.items as item}
      <ListItem {...item} />
    {/each}
  </List>
{/snippet}

<Story name="Empty" args={{ items: [] }} {template} />

<Story
  name="One Item"
  args={{
    items: [{ ...Unchecked.args }],
  }}
  {template}
/>
```

```svelte filename="List.stories.svelte" renderer="svelte" language="ts"
<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf';

  import List from './List.svelte';
  import ListItem from './ListItem.svelte';

  //👇 Imports a specific story from ListItem stories
  import { Unchecked } from './ListItem.stories.svelte';

  const { Story } = defineMeta({
    component: List,
  });
</script>

<!--
  The template construct will be spread to the existing stories.
  It's based on Svelte's snippet syntax allowing you share the same UI with small variations.
-->
{#snippet template(args)}
  <List {...args}>
    {#each args.items as item}
      <ListItem {...item} />
    {/each}
  </List>
{/snippet}

<Story name="Empty" args={{ items: [] }} {template} />

<Story
  name="One Item"
  args={{
    items: [{ ...Unchecked.args }],
  }}
  {template}
/>
```

```js filename="List.stories.js" renderer="vue" language="js" tabTitle="CSF 3"
import List from './List.vue';
import ListItem from './ListItem.vue';

//👇 Imports a specific story from ListItem stories
import { Unchecked } from './ListItem.stories';

export default {
  component: List,
};

//👇 The ListTemplate construct will be spread to the existing stories.
const ListTemplate = {
  render: (args) => ({
    components: { List, ListItem },
    setup() {
      return { ...args };
    },
    template: `
      <List v-bind="args">
        <div v-for="item in items" :key="item.title">
          <ListItem :item="item"/>
        </div>
      </List>
    `,
  }),
};

export const Empty = {
  ...ListTemplate,
  args: {
    items: [],
  },
};
export const OneItem = {
  ...ListTemplate,
  args: {
    items: [{ ...Unchecked.args }],
  },
};
```

```ts filename="List.stories.ts" renderer="vue" language="ts" tabTitle="CSF 3"
import type { Meta, StoryObj } from '@storybook/vue3-vite';

import List from './List.vue';
import ListItem from './ListItem.vue';

//👇 Imports a specific story from ListItem stories
import { Unchecked } from './ListItem.stories';

const meta = {
  component: List,
} satisfies Meta<typeof List>;

export default meta;
type Story = StoryObj<typeof meta>;

//👇 The ListTemplate construct will be spread to the existing stories.
export const ListTemplate: Story = {
  render: (args) => ({
    components: { List, ListItem },
    setup() {
      return { ...args };
    },
    template: `
      <List v-bind="args">
        <div v-for="item in items" :key="item.title">
          <ListItem :item="item"/>
        </div>
      </List>
    `,
  }),
};

export const Empty: Story = {
  ...ListTemplate,
  args: {
    items: [],
  },
};
export const OneItem: Story = {
  ...ListTemplate,
  args: {
    items: [{ ...Unchecked.args }],
  },
};
```

```ts filename="List.stories.ts" renderer="vue" language="ts" tabTitle="CSF Next 🧪"
import preview from '../.storybook/preview';

import List from './List.vue';
import ListItem from './ListItem.vue';

//👇 Imports a specific story from ListItem stories
import { Unchecked } from './ListItem.stories';

const meta = preview.meta({
  component: List,
});

export const Empty = meta.story({
  render: (args) => ({
    components: { List, ListItem },
    setup() {
      return { ...args };
    },
    template: `
      <List v-bind="args">
        <div v-for="item in items" :key="item.title">
          <ListItem :item="item"/>
        </div>
      </List>
    `,
  }),
  args: {
    items: [],
  },
});

export const OneItem = Empty.extend({
  args: {
    items: [{ ...Unchecked.input.args }],
  },
});
```

<!-- JS snippets still needed while providing both CSF 3 & Next -->

```js filename="List.stories.js" renderer="vue" language="js" tabTitle="CSF Next 🧪"
import preview from '../.storybook/preview';

import List from './List.vue';
import ListItem from './ListItem.vue';

//👇 Imports a specific story from ListItem stories
import { Unchecked } from './ListItem.stories';

const meta = preview.meta({
  component: List,
});

export const Empty = meta.story({
  render: (args) => ({
    components: { List, ListItem },
    setup() {
      return { ...args };
    },
    template: `
      <List v-bind="args">
        <div v-for="item in items" :key="item.title">
          <ListItem :item="item"/>
        </div>
      </List>
    `,
  }),
  args: {
    items: [],
  },
});

export const OneItem = Empty.extend({
  args: {
    items: [{ ...Unchecked.input.args }],
  },
});
```

```js filename="List.stories.js" renderer="web-components" language="js" tabTitle="CSF 3"
import { html } from 'lit';
import { repeat } from 'lit/directives/repeat.js';

import { Unchecked } from './ListItem.stories';

export default {
  component: 'demo-list',
};

//👇 The ListTemplate construct will be spread to the existing stories.
const ListTemplate = {
  render: ({ items, ...args }) => {
    return html`
      <demo-list>
        ${repeat(items, (item) => html`<demo-list-item>${item}</demo-list-item>`)}
      </demo-list>
    `;
  },
};
export const Empty = {
  ...ListTemplate,
  args: {
    items: [],
  },
};

export const OneItem = {
  ...ListTemplate,
  args: {
    items: [{ ...Unchecked.args }],
  },
};
```

```ts filename="List.stories.ts" renderer="web-components" language="ts" tabTitle="CSF 3"
import type { Meta, StoryObj } from '@storybook/web-components-vite';

import { html } from 'lit';
import { repeat } from 'lit/directives/repeat.js';

const meta: Meta = {
  component: 'demo-list',
};

export default meta;
type Story = StoryObj;

//👇 The ListTemplate construct will be spread to the existing stories.
const ListTemplate = {
  render: ({ items, ...args }) => {
    return html`
      <demo-list>
        ${repeat(items, (item) => html`<demo-list-item>${item}</demo-list-item>`)}
      </demo-list>
    `;
  },
};

export const Empty: Story = {
  ...ListTemplate,
  args: {
    items: [],
  },
};

export const OneItem: Story = {
  ...ListTemplate,
  args: {
    items: [{ ...Unchecked.args }],
  },
};
```

```js filename="List.stories.js" renderer="web-components" language="js" tabTitle="CSF Next 🧪"
import { html } from 'lit';
import { repeat } from 'lit/directives/repeat.js';

import preview from '../.storybook/preview';

import { Unchecked } from './ListItem.stories';

const meta = preview.meta({
  component: 'demo-list',
});

export const Empty = meta.story({
  render: ({ items, ...args }) => {
    return html`
      <demo-list>
        ${repeat(items, (item) => html`<demo-list-item>${item}</demo-list-item>`)}
      </demo-list>
    `;
  },
  args: {
    items: [],
  },
});

export const OneItem = Empty.extend({
  args: {
    items: [{ ...Unchecked.input.args }],
  },
});
```

```ts filename="List.stories.ts" renderer="web-components" language="ts" tabTitle="CSF Next 🧪"
import { html } from 'lit';
import { repeat } from 'lit/directives/repeat.js';

import preview from '../.storybook/preview';

import { Unchecked } from './ListItem.stories';

const meta = preview.meta({
  component: 'demo-list',
});

export const Empty = meta.story({
  render: ({ items, ...args }) => {
    return html`
      <demo-list>
        ${repeat(items, (item) => html`<demo-list-item>${item}</demo-list-item>`)}
      </demo-list>
    `;
  },
  args: {
    items: [],
  },
});

export const OneItem = Empty.extend({
  args: {
    items: [{ ...Unchecked.input.args }],
  },
});
```

```tsx filename="List.stories.ts|tsx" renderer="react" language="ts" tabTitle="CSF Next 🧪"
import preview from '../.storybook/preview';

import { List } from './List';
import { ListItem } from './ListItem';

//👇 Imports a specific story from ListItem stories
import { Unchecked } from './ListItem.stories';

const meta = preview.meta({
  component: List,
});

export const Empty = meta.story({
  render: ({ items, ...args }) => {
    return (
      <List>
        {items.map((item) => (
          <ListItem {...item} />
        ))}
      </List>
    );
  },
  args: {
    items: [],
  },
});

export const OneItem = Empty.extend({
  args: {
    items: [{ ...Unchecked.input.args }],
  },
});
```

<!-- JS snippets still needed while providing both CSF 3 & Next -->

```jsx filename="List.stories.js|jsx" renderer="react" language="js" tabTitle="CSF Next 🧪"
import preview from '../.storybook/preview';
import { List } from './List';
import { ListItem } from './ListItem';

//👇 Imports a specific story from ListItem stories
import { Unchecked } from './ListItem.stories';

const meta = preview.meta({
  component: List,
});

export const Empty = meta.story({
  render: ({ items, ...args }) => {
    return (
      <List>
        {items.map((item) => (
          <ListItem {...item} />
        ))}
      </List>
    );
  },
  args: {
    items: [],
  },
});

export const OneItem = Empty.extend({
  args: {
    items: [{ ...Unchecked.input.args }],
  },
});
```
