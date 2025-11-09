```ts filename="List.stories.ts" renderer="angular" language="ts"
import type { Meta, StoryObj } from '@storybook/angular';

import { moduleMetadata } from '@storybook/angular';

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

```jsx filename="List.stories.js|jsx" renderer="react" language="js" tabTitle="CSF 3"
import { List } from './List';

//👇 Instead of importing ListItem, we import the stories
import { Unchecked } from './ListItem.stories';

export default {
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

```tsx filename="List.stories.ts|tsx" renderer="react" language="ts" tabTitle="CSF 3"
// Replace your-framework with the framework you are using, e.g. react-vite, nextjs, nextjs-vite, etc.
import type { Meta, StoryObj } from '@storybook/your-framework';

import { List } from './List';

//👇 Instead of importing ListItem, we import the stories
import { Unchecked } from './ListItem.stories';

export const meta = {
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

```jsx filename="List.stories.js|jsx" renderer="solid" language="js"
import { List } from './List';

//👇 Instead of importing ListItem, we import the stories
import { Unchecked } from './ListItem.stories';

export default {
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

```tsx filename="List.stories.ts|tsx" renderer="solid" language="ts"
import type { Meta, StoryObj } from 'storybook-solidjs-vite';

import { List } from './List';

//👇 Instead of importing ListItem, we import the stories
import { Unchecked } from './ListItem.stories';

export const meta = {
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

```js filename="List.stories.js" renderer="vue" language="js"
import List from './List.vue';
import ListItem from './ListItem.vue';

//👇 Imports a specific story from ListItem stories
import { Unchecked } from './ListItem.stories';

export default {
  component: List,
};

/*
 *👇 Render functions are a framework specific feature to allow you control on how the component renders.
 * See https://storybook.js.org/docs/api/csf
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

```ts filename="List.stories.js" renderer="vue" language="ts"
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

/*
 *👇 Render functions are a framework specific feature to allow you control on how the component renders.
 * See https://storybook.js.org/docs/api/csf
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
import type { Meta, StoryObj } from '@storybook/web-components-vite';

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

```tsx filename="List.stories.ts|tsx" renderer="react" language="ts" tabTitle="CSF Next 🧪"
import preview from '../.storybook/preview';

import { List } from './List';

//👇 Instead of importing ListItem, we import the stories
import { Unchecked } from './ListItem.stories';

const meta = preview.meta({
  component: List,
});

export const OneItem = meta.story({
  render: (args) => (
    <List {...args}>
      <Unchecked {...Unchecked.input.args} />
    </List>
  ),
});
```

<!-- JS snippets still needed while providing both CSF 3 & Next -->

```jsx filename="List.stories.js|jsx" renderer="react" language="js" tabTitle="CSF Next 🧪"
import preview from '../.storybook/preview';

import { List } from './List';

//👇 Instead of importing ListItem, we import the stories
import { Unchecked } from './ListItem.stories';

const meta = preview.meta({
  component: List,
});

export const OneItem = meta.story({
  render: (args) => (
    <List {...args}>
      <Unchecked {...Unchecked.input.args} />
    </List>
  ),
});
```
