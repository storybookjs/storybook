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
   * See https://storybook.js.org/docs/7/configure#configure-story-loading
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
 * See https://storybook.js.org/docs/7/api/csf
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
   * See https://storybook.js.org/docs/7/configure#configure-story-loading
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

```tsx filename="List.stories.ts|tsx" renderer="react" language="ts-4-9"
import type { Meta, StoryObj } from '@storybook/react';

import { List } from './List';
import { ListItem } from './ListItem';

//👇 Imports a specific story from ListItem stories
import { Unchecked } from './ListItem.stories';

const meta = {
  /* 👇 The title prop is optional.
   * Seehttps://storybook.js.org/docs/7/configure#configure-story-loading
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

```ts filename="List.stories.ts|tsx" renderer="react" language="ts"
import type { Meta, StoryObj } from '@storybook/react';

import { List } from './List';
import { ListItem } from './ListItem';

//👇 Imports a specific story from ListItem stories
import { Unchecked } from './ListItem.stories';

const meta: Meta<typeof List> = {
  /* 👇 The title prop is optional.
   * Seehttps://storybook.js.org/docs/7/configure#configure-story-loading
   * to learn how to generate automatic titles
   */
  title: 'List',
  component: List,
};

export default meta;
type Story = StoryObj<typeof List>;

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
   * See https://storybook.js.org/docs/7/configure#configure-story-loading
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

```tsx filename="List.stories.ts|tsx" renderer="solid" language="ts-4-9"
import type { Meta, StoryObj } from 'storybook-solidjs';

import { List } from './List';
import { ListItem } from './ListItem';

//👇 Imports a specific story from ListItem stories
import { Unchecked } from './ListItem.stories';

const meta = {
  /* 👇 The title prop is optional.
   * Seehttps://storybook.js.org/docs/7/configure#configure-story-loading
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

```tsx filename="List.stories.ts|tsx" renderer="solid" language="ts"
import type { Meta, StoryObj } from 'storybook-solidjs';

import { List } from './List';
import { ListItem } from './ListItem';

//👇 Imports a specific story from ListItem stories
import { Unchecked } from './ListItem.stories';

const meta: Meta<typeof List> = {
  /* 👇 The title prop is optional.
   * Seehttps://storybook.js.org/docs/7/configure#configure-story-loading
   * to learn how to generate automatic titles
   */
  title: 'List',
  component: List,
};

export default meta;
type Story = StoryObj<typeof List>;

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

```js filename="List.stories.js" renderer="vue" language="js" tabTitle="2"
import List from './List.vue';
import ListItem from './ListItem.vue';

//👇 Imports a specific story from ListItem stories
import { Unchecked } from './ListItem.stories';

export default {
  /* 👇 The title prop is optional.
   * See https://storybook.js.org/docs/7/configure#configure-story-loading
   * to learn how to generate automatic titles
   */
  title: 'List',
  component: List,
};

//👇 The ListTemplate construct will be spread to the existing stories.
const ListTemplate = (args, { argTypes }) => ({
  props: Object.keys(argTypes),
  components: { List, ListItem },
  template: `
    <List v-bind="$props">
      <div v-for="item in items" :key="item.title">
        <ListItem :item="item" />
      </div>
    </List>
    `,
});

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

```ts filename="List.stories.ts" renderer="vue" language="ts-4-9" tabTitle="2"
import type { Meta, StoryObj } from '@storybook/vue';

import List from './List.vue';
import ListItem from './ListItem.vue';

//👇 Imports a specific story from ListItem stories
import { Unchecked } from './ListItem.stories';

const meta = {
  /* 👇 The title prop is optional.
   * See https://storybook.js.org/docs/7/configure#configure-story-loading
   * to learn how to generate automatic titles
   */
  title: 'List',
  component: List,
} satisfies Meta<typeof List>;

export default meta;
type Story = StoryObj<typeof meta>;

//👇 The ListTemplate construct will be spread to the existing stories.
const ListTemplate = {
  render: (args, { argTypes }) => ({
    components: { List, ListItem },
    props: Object.keys(argTypes),
    template: `
      <List v-bind="$props">
        <div v-for="item in items" :key="item.title">
          <ListItem :item="item" />
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

```ts filename="List.stories.ts" renderer="vue" language="ts" tabTitle="2"
import type { Meta, StoryObj } from '@storybook/vue';

import List from './List.vue';
import ListItem from './ListItem.vue';

//👇 Imports a specific story from ListItem stories
import { Unchecked } from './ListItem.stories';

const meta: Meta<typeof List> = {
  /* 👇 The title prop is optional.
   * See https://storybook.js.org/docs/7/configure#configure-story-loading
   * to learn how to generate automatic titles
   */
  title: 'List',
  component: List,
};

export default meta;
type Story = StoryObj<typeof List>;

//👇 The ListTemplate construct will be spread to the existing stories.
const ListTemplate = {
  render: (args, { argTypes }) => ({
    components: { List, ListItem },
    props: Object.keys(argTypes),
    template: `
      <List v-bind="$props">
        <div v-for="item in items" :key="item.title">
          <ListItem :item="item" />
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

```js filename="List.stories.js" renderer="vue" language="js" tabTitle="3"
import List from './List.vue';
import ListItem from './ListItem.vue';

//👇 Imports a specific story from ListItem stories
import { Unchecked } from './ListItem.stories';

export default {
  /* 👇 The title prop is optional.
   * See https://storybook.js.org/docs/7/configure#configure-story-loading
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

```ts filename="List.stories.ts" renderer="vue" language="ts-4-9" tabTitle="3"
import type { Meta, StoryObj } from '@storybook/vue3';

import List from './List.vue';
import ListItem from './ListItem.vue';

//👇 Imports a specific story from ListItem stories
import { Unchecked } from './ListItem.stories';

const meta = {
  /* 👇 The title prop is optional.
   * See https://storybook.js.org/docs/7/configure#configure-story-loading
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

```ts filename="List.stories.ts" renderer="vue" language="ts" tabTitle="3"
import type { Meta, StoryObj } from '@storybook/vue3';

import List from './List.vue';
import ListItem from './ListItem.vue';

//👇 Imports a specific story from ListItem stories
import { Unchecked } from './ListItem.stories';

const meta: Meta<typeof List> = {
  /* 👇 The title prop is optional.
   * See https://storybook.js.org/docs/7/configure#configure-story-loading
   * to learn how to generate automatic titles
   */
  title: 'List',
  component: List,
};

export default meta;
type Story = StoryObj<typeof List>;

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
import type { Meta, StoryObj } from '@storybook/web-components';

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
