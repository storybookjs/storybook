```ts filename="List.stories.ts" renderer="angular" language="ts"
import type { Meta, StoryObj } from '@storybook/angular';

import { moduleMetadata } from '@storybook/angular';

import { CommonModule } from '@angular/common';

import { List } from './list.component';
import { ListItem } from './list-item.component';

//👇 Imports a specific story from ListItem stories
import { Unchecked } from './ListItem.stories';

const meta: Meta<List> = {
  /* 👇 The title prop is optional.
   * See https://storybook.js.org/docs/configure/#configure-story-loading
   * to learn how to generate automatic titles
   */
  title: 'List',
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

```js filename="List.stories.js|jsx" renderer="react" language="js"
import { List } from './List';
import { ListItem } from './ListItem';

//👇 Imports a specific story from ListItem stories
import { Unchecked } from './ListItem.stories';

export default {
  /* 👇 The title prop is optional.
   * See https://storybook.js.org/docs/configure/#configure-story-loading
   * to learn how to generate automatic titles
   */
  title: 'List',
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
    items: [
      {
        ...Unchecked.args,
      },
    ],
  },
};
```

```tsx filename="List.stories.ts|tsx" renderer="react" language="ts"
import type { Meta, StoryObj } from '@storybook/react-vite';

import { List } from './List';
import { ListItem } from './ListItem';

//👇 Imports a specific story from ListItem stories
import { Unchecked } from './ListItem.stories';

const meta = {
  /* 👇 The title prop is optional.
   * Seehttps://storybook.js.org/docs/configure/#configure-story-loading
   * to learn how to generate automatic titles
   */
  title: 'List',
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

```js filename="List.stories.js|jsx" renderer="solid" language="js"
import { List } from './List';
import { ListItem } from './ListItem';

//👇 Imports a specific story from ListItem stories
import { Unchecked } from './ListItem.stories';

export default {
  /* 👇 The title prop is optional.
   * See https://storybook.js.org/docs/configure/#configure-story-loading
   * to learn how to generate automatic titles
   */
  title: 'List',
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
    items: [
      {
        ...Unchecked.args,
      },
    ],
  },
};
```

```tsx filename="List.stories.ts|tsx" renderer="solid" language="ts"
import type { Meta, StoryObj } from 'storybook-solidjs';

import { List } from './List';
import { ListItem } from './ListItem';

//👇 Imports a specific story from ListItem stories
import { Unchecked } from './ListItem.stories';

const meta = {
  /* 👇 The title prop is optional.
   * Seehttps://storybook.js.org/docs/configure/#configure-story-loading
   * to learn how to generate automatic titles
   */
  title: 'List',
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
    /* 👇 The title prop is optional.
     * See https://storybook.js.org/docs/configure/#configure-story-loading
     * to learn how to generate automatic titles
    */
    title: 'List',
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
    items: [{ ...Unselected.args }],
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
    /* 👇 The title prop is optional.
     * See https://storybook.js.org/docs/configure/#configure-story-loading
     * to learn how to generate automatic titles
    */
    title: 'List',
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
    items: [{ ...Unselected.args }],
  }}
  {template}
/>
```

```js filename="List.stories.js" renderer="vue" language="js"
import List from './List.vue';
import ListItem from './ListItem.vue';

//👇 Imports a specific story from ListItem stories
import { Unchecked } from './ListItem.stories';

export default {
  /* 👇 The title prop is optional.
   * See https://storybook.js.org/docs/configure/#configure-story-loading
   * to learn how to generate automatic titles
   */
  title: 'List',
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
    items: [
      {
        ...Unchecked.args,
      },
    ],
  },
};
```

```ts filename="List.stories.ts" renderer="vue" language="ts"
import type { Meta, StoryObj } from '@storybook/vue3-vite';

import List from './List.vue';
import ListItem from './ListItem.vue';

//👇 Imports a specific story from ListItem stories
import { Unchecked } from './ListItem.stories';

const meta = {
  /* 👇 The title prop is optional.
   * See https://storybook.js.org/docs/configure/#configure-story-loading
   * to learn how to generate automatic titles
   */
  title: 'List',
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
    items: [
      {
        ...Unchecked.args,
      },
    ],
  },
};
```

```js filename="List.stories.js" renderer="web-components" language="js"
import { html } from 'lit';
import { repeat } from 'lit/directives/repeat.js';

import { Unchecked } from './ListItem.stories';

export default {
  title: 'List',
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
    items: [
      {
        ...Unchecked.args,
      },
    ],
  },
};
```

```ts filename="List.stories.ts" renderer="web-components" language="ts"
import type { Meta, StoryObj } from '@storybook/web-components-vite';

import { html } from 'lit';
import { repeat } from 'lit/directives/repeat.js';

const meta: Meta = {
  title: 'List',
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
    items: [
      {
        ...Unchecked.args,
      },
    ],
  },
};
```
