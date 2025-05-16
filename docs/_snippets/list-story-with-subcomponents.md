```ts filename="List.stories.ts" renderer="angular" language="ts"
import type { Meta, StoryObj } from '@storybook/angular';

import { moduleMetadata } from '@storybook/angular';

import { CommonModule } from '@angular/common';

import { List } from './list.component';
import { ListItem } from './list-item.component';

const meta: Meta<List> = {
  component: List,
  subcomponents: { ListItem }, //👈 Adds the ListItem component as a subcomponent
  decorators: [
    moduleMetadata({
      declarations: [List, ListItem],
      imports: [CommonModule],
    }),
  ],
};
export default meta;

type Story = StoryObj<List>;

export const Empty: Story = {};

export const OneItem: Story = {
  args: {},
  render: (args) => ({
    props: args,
    template: `
      <app-list>
        <app-list-item></app-list-item>
      </app-list>
  `,
  }),
};
```

```jsx filename="List.stories.js|jsx" renderer="react" language="js"
import React from 'react';

import { List } from './List';
import { ListItem } from './ListItem';

export default {
  component: List,
  subcomponents: { ListItem }, //👈 Adds the ListItem component as a subcomponent
};

export const Empty = {};

export const OneItem = {
  render: (args) => (
    <List {...args}>
      <ListItem />
    </List>
  ),
};
```

```tsx filename="List.stories.ts|tsx" renderer="react" language="ts"
import React from 'react';

import type { Meta, StoryObj } from '@storybook/react-vite';

import { List } from './List';
import { ListItem } from './ListItem';

const meta = {
  component: List,
  subcomponents: { ListItem }, //👈 Adds the ListItem component as a subcomponent
} satisfies Meta<typeof List>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Empty: Story = {};

export const OneItem: Story = {
  render: (args) => (
    <List {...args}>
      <ListItem />
    </List>
  ),
};
```

```js filename="List.stories.js|jsx" renderer="solid" language="js"
import { List } from './List';
import { ListItem } from './ListItem';

export default {
  /* 👇 The title prop is optional.
   * See https://storybook.js.org/docs/configure/#configure-story-loading
   * to learn how to generate automatic titles
   */
  title: 'List',
  component: List,
  subcomponents: { ListItem }, //👈 Adds the ListItem component as a subcomponent
};

export const Empty = {};

export const OneItem = {
  render: (args) => (
    <List {...args}>
      <ListItem />
    </List>
  ),
};
```

```tsx filename="List.stories.ts|tsx" renderer="solid" language="ts"
import type { Meta, StoryObj } from 'storybook-solidjs';

import { List } from './List';
import { ListItem } from './ListItem';

const meta = {
  /* 👇 The title prop is optional.
   * See https://storybook.js.org/docs/configure/#configure-story-loading
   * to learn how to generate automatic titles
   */
  title: 'List',
  component: List,
  //👈 Adds the ListItem component as a subcomponent
  subcomponents: { ListItem },
} satisfies Meta<typeof List>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {};

export const OneItem: Story = {
  render: (args) => (
    <List {...args}>
      <ListItem />
    </List>
  ),
};
```

```svelte filename="List.stories.svelte" renderer="svelte" language="js"
<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf';

  import List from './List.svelte';
  import ListItem from './ListItem.svelte';

  const { Story } = defineMeta({
    component: List,
    subcomponents: { ListItem },
  });
</script>

<Story name="Empty" />

<Story name="One Item">
  {#snippet children(args)}
    <List {...args}>
      <ListItem />
    </List>
  {/snippet}
</Story>
```

```svelte filename="List.stories.svelte" renderer="svelte" language="ts"
<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf';

  import List from './List.svelte';
  import ListItem from './ListItem.svelte';

  const { Story } = defineMeta({
    component: List,
    subcomponents: { ListItem },
  });
</script>

<Story name="Empty" />

<Story name="One Item">
  {#snippet children(args)}
    <List {...args}>
      <ListItem />
    </List>
  {/snippet}
</Story>
```

```js filename="List.stories.js" renderer="web-components" language="js"
import { html } from 'lit';

export default {
  title: 'List',
  component: 'demo-list',
  subcomponents: { ListItem: 'demo-list-item' }, // 👈 Adds the ListItem component as a subcomponent
};

export const Empty = {};

export const OneItem = {
  render: () => html`
    <demo-list>
      <demo-list-item></demo-list-item>
    </demo-list>
  `,
};
```

```ts filename="List.stories.ts" renderer="web-components" language="ts"
import type { Meta, StoryObj } from '@storybook/web-components-vite';

import { html } from 'lit';

const meta: Meta = {
  title: 'List',
  component: 'demo-list',
  subcomponents: { ListItem: 'demo-list-item' }, // 👈 Adds the ListItem component as a subcomponent
};
export default meta;

type Story = StoryObj;

export const Empty: Story = {};

export const OneItem: Story = {
  render: () => html`
    <demo-list>
      <demo-list-item></demo-list-item>
    </demo-list>
  `,
};
```

```js filename="List.stories.js" renderer="vue" language="js"
import List from './List.vue';
import ListItem from './ListItem.vue';

export default {
  component: List,
  subcomponents: { ListItem }, //👈 Adds the ListItem component as a subcomponent
};

export const Empty = {
  render: () => ({
    components: { List },
    template: '<List/>',
  }),
};

export const OneItem = {
  render: (args) => ({
    components: { List, ListItem },
    setup() {
      return { args }
    }
    template: '<List v-bind="args"><ListItem /></List>',
  }),
};
```

```ts filename="List.stories.ts" renderer="vue" language="ts"
import type { Meta, StoryObj } from '@storybook/vue3-vite';

import List from './List.vue';
import ListItem from './ListItem.vue';

const meta = {
  component: List,
  subcomponents: { ListItem }, //👈 Adds the ListItem component as a subcomponent
} satisfies Meta<typeof List>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Empty: Story = {
  render: () => ({
    components: { List },
    template: '<List />',
  }),
};

export const OneItem: Story = {
  render: (args) => ({
    components: { List, ListItem },
    setup() {
      return { args }
    }
    template: '<List v-bind="args"><ListItem /></List>',
  }),
};
```
