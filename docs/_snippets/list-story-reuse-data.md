```ts filename="List.stories.ts" renderer="angular" language="ts"
import type { Meta, StoryObj } from '@storybook/angular';

import { moduleMetadata } from '@storybook/angular';

import { CommonModule } from '@angular/common';

import { List } from './list.component';
import { ListItem } from './list-item.component';

//👇 We're importing the necessary stories from ListItem
import { Selected, Unselected } from './ListItem.stories';

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

export const ManyItems: Story = {
  args: {
    Selected: Selected.args.isSelected,
    Unselected: Unselected.args.isSelected,
  },
  render: (args) => ({
    props: args,
    template: `
      <app-list>
        <app-list-item [isSelected]="Selected"></app-list-item>
        <app-list-item [isSelected]="Unselected"></app-list-item>
        <app-list-item [isSelected]="Unselected"></app-list-item>
      </app-list>
    `,
  }),
};
```

```js filename="List.stories.js" renderer="html" language="js"
import { createList } from './List';
import { createListItem } from './ListItem';

// 👇 We're importing the necessary stories from ListItem
import { Selected, Unselected } from './ListItem.stories';

export default {
  title: 'List',
};

export const ManyItems = {
  render: (args) => {
    const list = createList(args);
    list.appendChild(createListItem(Selected.args));
    list.appendChild(createListItem(Unselected.args));
    list.appendChild(createListItem(Unselected.args));
    return list;
  },
};
```

```ts filename="List.stories.ts" renderer="html" language="ts"
import type { Meta, StoryObj } from '@storybook/html';

import { createList, ListArgs } from './List';
import { createListItem } from './ListItem';

// 👇 We're importing the necessary stories from ListItem
import { Selected, Unselected } from './ListItem.stories';

const meta: Meta<ListArgs> = {
  title: 'List',
};

export default meta;
type Story = StoryObj<ListArgs>;

export const ManyItems: Story = {
  render: (args) => {
    const list = createList(args);
    list.appendChild(createListItem(Selected.args));
    list.appendChild(createListItem(Unselected.args));
    list.appendChild(createListItem(Unselected.args));
    return list;
  },
};
```

```js filename="List.stories.js|jsx" renderer="react" language="js"
import React from 'react';

import { List } from './List';
import { ListItem } from './ListItem';

//👇 We're importing the necessary stories from ListItem
import { Selected, Unselected } from './ListItem.stories';

export default {
  component: List,
};

export const ManyItems = {
  render: (args) => (
    <List {...args}>
      <ListItem {...Selected.args} />
      <ListItem {...Unselected.args} />
      <ListItem {...Unselected.args} />
    </List>
  ),
};
```

```tsx filename="List.stories.ts|tsx" renderer="react" language="ts-4-9"
import type { Meta, StoryObj } from '@storybook/react';

import { List } from './List';
import { ListItem } from './ListItem';

//👇 We're importing the necessary stories from ListItem
import { Selected, Unselected } from './ListItem.stories';

const meta = {
  component: List,
} satisfies Meta<typeof List>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ManyItems: Story = {
  render: (args) => (
    <List {...args}>
      <ListItem {...Selected.args} />
      <ListItem {...Unselected.args} />
      <ListItem {...Unselected.args} />
    </List>
  ),
};
```

```tsx filename="List.stories.ts|tsx" renderer="react" language="ts"
import type { Meta, StoryObj } from '@storybook/react';

import { List } from './List';
import { ListItem } from './ListItem';

//👇 We're importing the necessary stories from ListItem
import { Selected, Unselected } from './ListItem.stories';

const meta: Meta<typeof List> = {
  component: List,
};

export default meta;
type Story = StoryObj<typeof List>;

export const ManyItems: Story = {
  render: (args) => (
    <List {...args}>
      <ListItem {...Selected.args} />
      <ListItem {...Unselected.args} />
      <ListItem {...Unselected.args} />
    </List>
  ),
};
```

```js filename="List.stories.js|jsx" renderer="solid" language="js"
import { List } from './List';
import { ListItem } from './ListItem';

//👇 We're importing the necessary stories from ListItem
import { Selected, Unselected } from './ListItem.stories';

export default {
  component: List,
};

export const ManyItems = {
  render: (args) => (
    <List {...args}>
      <ListItem {...Selected.args} />
      <ListItem {...Unselected.args} />
      <ListItem {...Unselected.args} />
    </List>
  ),
};
```

```tsx filename="List.stories.ts|tsx" renderer="solid" language="ts-4-9"
import type { Meta, StoryObj } from 'storybook-solidjs';

import { List } from './List';
import { ListItem } from './ListItem';

//👇 We're importing the necessary stories from ListItem
import { Selected, Unselected } from './ListItem.stories';

const meta = {
  component: List,
} satisfies Meta<typeof List>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ManyItems: Story = {
  render: (args) => (
    <List {...args}>
      <ListItem {...Selected.args} />
      <ListItem {...Unselected.args} />
      <ListItem {...Unselected.args} />
    </List>
  ),
};
```

```tsx filename="List.stories.ts|tsx" renderer="solid" language="ts"
import type { Meta, StoryObj } from 'storybook-solidjs';

import { List } from './List';
import { ListItem } from './ListItem';

//👇 All ListItem stories are imported
import { Selected, Unselected } from './ListItem.stories';

const meta: Meta<typeof List> = {
  component: List,
};

export default meta;
type Story = StoryObj<typeof List>;

export const ManyItems: Story = {
  render: (args) => (
    <List {...args}>
      <ListItem {...Selected.args} />
      <ListItem {...Unselected.args} />
      <ListItem {...Unselected.args} />
    </List>
  ),
};
```

```js filename="List.stories.js" renderer="vue" language="js"
import List from './ListComponent.vue';
import ListItem from './ListItem.vue';

//👇 We're importing the necessary stories from ListItem
import { Selected, Unselected } from './ListItem.stories';

export default {
  component: List,
};

export const ManyItems = {
  render: (args) => ({
    components: { List, ListItem },
    setup() {
      return { ...args };
    },
    template: `
      <List v-bind="args">
        <list-item :isSelected="Selected"/>
        <list-item :isSelected="Unselected"/>
        <list-item :isSelected="Unselected"/>
      </List>`,
  }),
  args: {
    Selected: Selected.args.isSelected,
    Unselected: Unselected.args.isSelected,
  },
};
```

```ts filename="List.stories.ts" renderer="vue" language="ts-4-9"
import type { Meta, StoryObj } from '@storybook/vue3';

import List from './ListComponent.vue';
import ListItem from './ListItem.vue';

//👇 We're importing the necessary stories from ListItem
import { Selected, Unselected } from './ListItem.stories';

const meta = {
  component: List,
} satisfies Meta<typeof List>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ManyItems: Story = {
  render: (args) => ({
    components: { List, ListItem },
    setup() {
      return { ...args };
    },
    template: `
      <List v-bind="args">
        <list-item :isSelected="Selected"/>
        <list-item :isSelected="Unselected"/>
        <list-item :isSelected="Unselected"/>
      </List>`,
  }),
  args: {
    Selected: Selected.args.isSelected,
    Unselected: Unselected.args.isSelected,
  },
};
```

```ts filename="List.stories.ts" renderer="vue" language="ts"
import type { Meta, StoryObj } from '@storybook/vue3';

import List from './ListComponent.vue';
import ListItem from './ListItem.vue';

//👇 We're importing the necessary stories from ListItem
import { Selected, Unselected } from './ListItem.stories';

const meta: Meta<typeof List> = {
  component: List,
};

export default meta;
type Story = StoryObj<typeof List>;

export const ManyItems: Story = {
  render: (args) => ({
    components: { List, ListItem },
    setup() {
      return { ...args };
    },
    template: `
      <List v-bind="args">
        <list-item :isSelected="Selected"/>
        <list-item :isSelected="Unselected"/>
        <list-item :isSelected="Unselected"/>
      </List>`,
  }),
  args: {
    Selected: Selected.args.isSelected,
    Unselected: Unselected.args.isSelected,
  },
};
```

```js filename="List.stories.js" renderer="web-components" language="js"
import { html } from 'lit';

// 👇 We're importing the necessary stories from ListItem
import { Selected, Unselected } from './ListItem.stories';

export default {
  component: 'demo-list',
};

export const ManyItems = {
  render: (args) => html`
    <demo-list>
      ${Selected({ ...args, ...Selected.args })} ${Unselected({ ...args, ...Unselected.args })}
      ${Unselected({ ...args, ...Unselected.args })}
    </demo-list>
  `,
};
```

```ts filename="List.stories.ts" renderer="web-components" language="ts"
import type { Meta, StoryObj } from '@storybook/web-components';

import { html } from 'lit';

// 👇 We're importing the necessary stories from ListItem
import { Selected, Unselected } from './ListItem.stories';

const meta: Meta = {
  component: 'demo-list',
};

export default meta;
type Story = StoryObj;

export const ManyItems: Story = {
  render: (args) => html`
    <demo-list>
      ${Selected({ ...args, ...Selected.args })} ${Unselected({ ...args, ...Unselected.args })}
      ${Unselected({ ...args, ...Unselected.args })}
    </demo-list>
  `,
};
```
