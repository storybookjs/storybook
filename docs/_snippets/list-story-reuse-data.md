```ts filename="List.stories.ts" renderer="angular" language="ts" tabTitle="CSF 3"
import { type Meta, type StoryObj, moduleMetadata } from '@storybook/angular';

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

```ts filename="List.stories.ts" renderer="angular" language="ts" tabTitle="CSF Next 🧪"
import { CommonModule } from '@angular/common';

import { moduleMetadata } from '@storybook/angular';

import preview from '../.storybook/preview';

import { List } from './list.component';
import { ListItem } from './list-item.component';

//👇 We're importing the necessary stories from ListItem
import { Selected, Unselected } from './ListItem.stories';

const meta = preview.meta({
  component: List,
  decorators: [
    moduleMetadata({
      declarations: [List, ListItem],
      imports: [CommonModule],
    }),
  ],
});

export const ManyItems = meta.story({
  args: {
    Selected: Selected.input.args.isSelected,
    Unselected: Unselected.input.args.isSelected,
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
});
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

```jsx filename="List.stories.js|jsx" renderer="react" language="js" tabTitle="CSF 3"
import * as React from 'react';

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

```tsx filename="List.stories.ts|tsx" renderer="react" language="ts" tabTitle="CSF 3"
import * as React from 'react';

// Replace your-framework with the framework you are using, e.g. react-vite, nextjs, nextjs-vite, etc.
import type { Meta, StoryObj } from '@storybook/your-framework';

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

```jsx filename="List.stories.js|jsx" renderer="solid" language="js"
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

```tsx filename="List.stories.ts|tsx" renderer="solid" language="ts"
import type { Meta, StoryObj } from 'storybook-solidjs-vite';

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

```svelte filename="List.stories.svelte" renderer="svelte" language="js"
<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf';

  import List from './List.svelte';
  import ListItem from './ListItem.svelte';

  //👇 We're importing the necessary stories from ListItem
  import { Selected, Unselected } from './ListItem.stories.svelte';

  const { Story } = defineMeta({
    component: List,
  });
</script>

<Story name="Many Items">
  {#snippet children(args)}
    <List {...args}>
      <ListItem {...Selected.args} />
      <ListItem {...Unselected.args} />
      <ListItem {...Unselected.args} />
    </List>
  {/snippet}
</Story>
```

```svelte filename="List.stories.svelte" renderer="svelte" language="ts"
<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf';

  import List from './List.svelte';
  import ListItem from './ListItem.svelte';

  //👇 We're importing the necessary stories from ListItem
  import { Selected, Unselected } from './ListItem.stories.svelte';

  const { Story } = defineMeta({
    component: List,
  });
</script>

<Story name="Many Items">
  {#snippet children(args)}
    <List {...args}>
      <ListItem {...Selected.args} />
      <ListItem {...Unselected.args} />
      <ListItem {...Unselected.args} />
    </List>
  {/snippet}
</Story>
```

```js filename="List.stories.js" renderer="vue" language="js" tabTitle="CSF 3"
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

```ts filename="List.stories.ts" renderer="vue" language="ts" tabTitle="CSF 3"
import type { Meta, StoryObj } from '@storybook/vue3-vite';

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

```ts filename="List.stories.ts" renderer="vue" language="ts" tabTitle="CSF Next 🧪"
import preview from '../.storybook/preview';

import List from './ListComponent.vue';
import ListItem from './ListItem.vue';

//👇 We're importing the necessary stories from ListItem
import { Selected, Unselected } from './ListItem.stories';

const meta = preview.meta({
  component: List,
});

export const ManyItems = meta.story({
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
    Selected: Selected.input.args.isSelected,
    Unselected: Unselected.input.args.isSelected,
  },
});
```

<!-- JS snippets still needed while providing both CSF 3 & Next -->

```js filename="List.stories.js" renderer="vue" language="js" tabTitle="CSF Next 🧪"
import preview from '../.storybook/preview';

import List from './ListComponent.vue';
import ListItem from './ListItem.vue';

//👇 We're importing the necessary stories from ListItem
import { Selected, Unselected } from './ListItem.stories';

const meta = preview.meta({
  component: List,
});

export const ManyItems = meta.story({
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
    Selected: Selected.input.args.isSelected,
    Unselected: Unselected.input.args.isSelected,
  },
});
```

```tsx filename="List.stories.ts|tsx" renderer="react" language="ts" tabTitle="CSF Next 🧪"
import * as React from 'react';

import preview from '../.storybook/preview';

import { List } from './List';
import { ListItem } from './ListItem';

//👇 We're importing the necessary stories from ListItem
import { Selected, Unselected } from './ListItem.stories';

const meta = preview.meta({
  component: List,
});

export const ManyItems = meta.story({
  render: (args) => (
    <List {...args}>
      <ListItem {...Selected.input.args} />
      <ListItem {...Unselected.input.args} />
      <ListItem {...Unselected.input.args} />
    </List>
  ),
});
```

<!-- JS snippets still needed while providing both CSF 3 & Next -->

```jsx filename="List.stories.js|jsx" renderer="react" language="js" tabTitle="CSF Next 🧪"
import * as React from 'react';

import preview from '../.storybook/preview';

import { List } from './List';
import { ListItem } from './ListItem';

//👇 We're importing the necessary stories from ListItem
import { Selected, Unselected } from './ListItem.stories';

const meta = preview.meta({
  component: List,
});

export const ManyItems = meta.story({
  render: (args) => (
    <List {...args}>
      <ListItem {...Selected.input.args} />
      <ListItem {...Unselected.input.args} />
      <ListItem {...Unselected.input.args} />
    </List>
  ),
});
```
