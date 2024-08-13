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
export const OneItem: Story = {
  render: (args) => ({
    props: args,
    template: `
      <app-list>
        <app-list-item [item]="item"></app-list-item>
      </app-list>
   `,
  }),
  args: {
    ...Unchecked.args,
  },
};
```

```js filename="List.stories.js|jsx" renderer="react" language="js"
import { List } from './List';

//👇 Instead of importing ListItem, we import the stories
import { Unchecked } from './ListItem.stories';

export default {
  /* 👇 The title prop is optional.
   * See https://storybook.js.org/docs/7/configure#configure-story-loading
   * to learn how to generate automatic titles
   */
  title: 'List',
  component: List,
};

export const OneItem = {
  render: (args) => (
    <List {...args}>
      <Unchecked {...Unchecked.args} />
    </List>
  ),
};
```

```ts filename="List.stories.ts|tsx" renderer="react" language="ts-4-9"
import type { Meta, StoryObj } from '@storybook/react';

import { List } from './List';

//👇 Instead of importing ListItem, we import the stories
import { Unchecked } from './ListItem.stories';

export const meta = {
  /* 👇 The title prop is optional.
   * See https://storybook.js.org/docs/7/configure#configure-story-loading
   * to learn how to generate automatic titles
   */
  title: 'List',
  component: List,
} satisfies Meta<typeof List>;

export default meta;
type Story = StoryObj<typeof meta>;

export const OneItem: Story = {
  render: (args) => (
    <List {...args}>
      <Unchecked {...Unchecked.args} />
    </List>
  ),
};
```

```tsx filename="List.stories.ts|tsx" renderer="react" language="ts"
import type { Meta, StoryObj } from '@storybook/react';

import { List } from './List';

//👇 Instead of importing ListItem, we import the stories
import { Unchecked } from './ListItem.stories';

export const meta: Meta<typeof List> = {
  /* 👇 The title prop is optional.
   * See https://storybook.js.org/docs/7/configure#configure-story-loading
   * to learn how to generate automatic titles
   */
  title: 'List',
  component: List,
};

export default meta;
type Story = StoryObj<typeof List>;

export const OneItem: Story = {
  render: (args) => (
    <List {...args}>
      <Unchecked {...Unchecked.args} />
    </List>
  ),
};
```

```js filename="List.stories.js|jsx" renderer="solid" language="js"
import { List } from './List';

//👇 Instead of importing ListItem, we import the stories
import { Unchecked } from './ListItem.stories';

export default {
  /* 👇 The title prop is optional.
   * See https://storybook.js.org/docs/7/configure#configure-story-loading
   * to learn how to generate automatic titles
   */
  title: 'List',
  component: List,
};

export const OneItem = {
  render: (args) => (
    <List {...args}>
      <Unchecked {...Unchecked.args} />
    </List>
  ),
};
```

```tsx filename="List.stories.ts|tsx" renderer="solid" language="ts-4-9"
import type { Meta, StoryObj } from 'storybook-solidjs';

import { List } from './List';

//👇 Instead of importing ListItem, we import the stories
import { Unchecked } from './ListItem.stories';

export const meta = {
  /* 👇 The title prop is optional.
   * See https://storybook.js.org/docs/7/configure#configure-story-loading
   * to learn how to generate automatic titles
   */
  title: 'List',
  component: List,
} satisfies Meta<typeof List>;

export default meta;
type Story = StoryObj<typeof meta>;

export const OneItem: Story = {
  render: (args) => (
    <List {...args}>
      <Unchecked {...Unchecked.args} />
    </List>
  ),
};
```

```tsx filename="List.stories.ts|tsx" renderer="solid" language="ts"
import type { Meta, StoryObj } from 'storybook-solidjs';

import { List } from './List';

//👇 Instead of importing ListItem, we import the stories
import { Unchecked } from './ListItem.stories';

export const meta: Meta<typeof List> = {
  /* 👇 The title prop is optional.
   * See https://storybook.js.org/docs/7/configure#configure-story-loading
   * to learn how to generate automatic titles
   */
  title: 'List',
  component: List,
};

export default meta;
type Story = StoryObj<typeof List>;

export const OneItem: Story = {
  render: (args) => (
    <List {...args}>
      <Unchecked {...Unchecked.args} />
    </List>
  ),
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
/*
 *👇 Render functions are a framework specific feature to allow you control on how the component renders.
 * See https://storybook.js.org/docs/7/api/csf
 * to learn how to use render functions.
 */
export const OneItem = {
  render: (args, { argTypes }) => ({
    props: Object.keys(argTypes),
    components: { List, ListItem },
    template: '<List v-bind="$props"><ListItem v-bind="$props"/></List>',
  }),
  args: {
    ...Unchecked.args,
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

/*
 *👇 Render functions are a framework specific feature to allow you control on how the component renders.
 * See https://storybook.js.org/docs/7/api/csf
 * to learn how to use render functions.
 */
export const OneItem: Story = {
  render: (args, { argTypes }) => ({
    props: Object.keys(argTypes),
    components: { List, ListItem },
    template: '<List v-bind="$props"><ListItem v-bind="$props"/></List>',
  }),
  args: {
    ...Unchecked.args,
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

/*
 *👇 Render functions are a framework specific feature to allow you control on how the component renders.
 * See https://storybook.js.org/docs/7/api/csf
 * to learn how to use render functions.
 */
export const OneItem: Story = {
  render: (args, { argTypes }) => ({
    props: Object.keys(argTypes),
    components: { List, ListItem },
    template: '<List v-bind="$props"><ListItem v-bind="$props"/></List>',
  }),
  args: {
    ...Unchecked.args,
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

/*
 *👇 Render functions are a framework specific feature to allow you control on how the component renders.
 * See https://storybook.js.org/docs/7/api/csf
 * to learn how to use render functions.
 */
export const OneItem = {
  args: {
    ...Unchecked.args,
  },
  render: (args) => ({
    components: { List, ListItem },
    setup() {
      //👇 The args will now be passed down to the template
      return { args };
    },
    template: '<List v-bind="args"><ListItem v-bind="args"/></List>',
  }),
};
```

```ts filename="List.stories.js" renderer="vue" language="ts-4-9" tabTitle="3"
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

/*
 *👇 Render functions are a framework specific feature to allow you control on how the component renders.
 * See https://storybook.js.org/docs/7/api/csf
 * to learn how to use render functions.
 */
export const OneItem: Story = {
  render: (args) => ({
    components: { List, ListItem },
    setup() {
      //👇 The args will now be passed down to the template
      return { args };
    },
    template: '<List v-bind="args"><ListItem v-bind="args"/></List>',
  }),
  args: {
    ...Unchecked.args,
  },
};
```

```ts filename="List.stories.js" renderer="vue" language="ts" tabTitle="3"
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

/*
 *👇 Render functions are a framework specific feature to allow you control on how the component renders.
 * See https://storybook.js.org/docs/7/api/csf
 * to learn how to use render functions.
 */
export const OneItem: Story = {
  render: (args) => ({
    components: { List, ListItem },
    setup() {
      //👇 The args will now be passed down to the template
      return { args };
    },
    template: '<List v-bind="args"><ListItem v-bind="args"/></List>',
  }),
  args: {
    ...Unchecked.args,
  },
};
```

```js filename="MyList.stories.js" renderer="web-components" language="js"
import { html } from 'lit';

// 👇 Import the stories of MyListItem
import { Unchecked } from './MyListItem.stories';

export default {
  title: 'MyList',
  component: 'demo-my-list',
};

export const OneItem = {
  render: () => html` <List> ${Unchecked({ ...Unchecked.args })} </List> `,
};
```

```ts filename="MyList.stories.ts" renderer="web-components" language="ts"
import { Meta, StoryObj } from '@storybook/web-components';

import { html } from 'lit';

// 👇 Import the stories of MyListItem
import { Unchecked } from './my-list-item.stories';

const meta: Meta = {
  title: 'MyList',
  component: 'demo-my-list',
};
export default meta;

type Story = StoryObj;

export const OneItem: Story = {
  render: () => html` <List> ${Unchecked({ ...Unchecked.args })} </List> `,
};
```
