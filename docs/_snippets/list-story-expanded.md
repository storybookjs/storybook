```ts filename="List.stories.ts" renderer="angular" language="ts"
import type { Meta, StoryObj } from '@storybook/angular';

import { moduleMetadata } from '@storybook/angular';

import { CommonModule } from '@angular/common';

import { List } from './list.component';
import { ListItem } from './list-item.component';

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

// Always an empty list, not super interesting
export const Empty: Story = {
  render: (args) => ({
    props: args,
    template: '<app-list></app-list>',
  }),
};

export const OneItem: Story = {
  render: (args) => ({
    props: args,
    template: `
      <app-list>
        <app-list-item></app-list-item>
      </app-list>`,
  }),
};

export const ManyItems: Story = {
  render: (args) => ({
    props: args,
    template: `
      <app-list>
        <app-list-item></app-list-item>
        <app-list-item></app-list-item>
        <app-list-item></app-list-item>
      </app-list>
    `,
  }),
};
```

```js filename="List.stories.js" renderer="html" language="js"
import { createList } from './List';
import { createListItem } from './ListItem';

export default {
  /* 👇 The title prop is optional.
   * See https://storybook.js.org/docs/configure/#configure-story-loading
   * to learn how to generate automatic titles
   */
  title: 'List',
};

/*
 *👇 Render functions are a framework specific feature to allow you control on how the component renders.
 * See https://storybook.js.org/docs/api/csf
 * to learn how to use render functions.
 */
export const Empty = {
  render: () => createList(args),
};

export const OneItem = {
  render: (args) => {
    const list = createList(args);
    list.appendChild(createListItem());
    return list;
  },
};

export const ManyItems = {
  render: (args) => {
    const list = createList(args);
    list.appendChild(createListItem());
    list.appendChild(createListItem());
    list.appendChild(createListItem());
    return list;
  },
};
```

```ts filename="List.stories.ts" renderer="html" language="ts"
import type { Meta, StoryObj } from '@storybook/html';

import { createList, ListArgs } from './List';
import { createListItem } from './ListItem';

const meta: Meta<ListArgs> = {
  title: 'List',
};

export default meta;
type Story = StoryObj<ListArgs>;

/*
 *👇 Render functions are a framework specific feature to allow you control on how the component renders.
 * See https://storybook.js.org/docs/api/csf
 * to learn how to use render functions.
 */
export const Empty: Story = {
  render: () => createList(args),
};

export const OneItem: Story = {
  render: (args) => {
    const list = createList(args);
    list.appendChild(createListItem());
    return list;
  },
};

export const ManyItems: Story = {
  render: (args) => {
    const list = createList(args);
    list.appendChild(createListItem());
    list.appendChild(createListItem());
    list.appendChild(createListItem());
    return list;
  },
};
```

```js filename="List.stories.js|jsx" renderer="react" language="js"
import { List } from './List';
import { ListItem } from './ListItem';

export default {
  component: List,
};

export const Empty = {};

/*
 *👇 Render functions are a framework specific feature to allow you control on how the component renders.
 * See https://storybook.js.org/docs/api/csf
 * to learn how to use render functions.
 */
export const OneItem = {
  render: (args) => (
    <List {...args}>
      <ListItem />
    </List>
  ),
};

export const ManyItems = {
  render: (args) => (
    <List {...args}>
      <ListItem />
      <ListItem />
      <ListItem />
    </List>
  ),
};
```

```tsx filename="List.stories.ts|tsx" renderer="react" language="ts-4-9"
import type { Meta, StoryObj } from '@storybook/react';

import { List } from './List';
import { ListItem } from './ListItem';

const meta = {
  component: List,
} satisfies Meta<typeof List>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {};

/*
 *👇 Render functions are a framework specific feature to allow you control on how the component renders.
 * See https://storybook.js.org/docs/api/csf
 * to learn how to use render functions.
 */
export const OneItem: Story = {
  render: (args) => (
    <List {...args}>
      <ListItem />
    </List>
  ),
};

export const ManyItems: Story = {
  render: (args) => (
    <List {...args}>
      <ListItem />
      <ListItem />
      <ListItem />
    </List>
  ),
};
```

```tsx filename="List.stories.ts|tsx" renderer="react" language="ts"
import type { Meta, StoryObj } from '@storybook/react';

import { List } from './List';
import { ListItem } from './ListItem';

const meta: Meta<typeof List> = {
  component: List,
};

export default meta;
type Story = StoryObj<typeof List>;

export const Empty: Story = {};

/*
 *👇 Render functions are a framework specific feature to allow you control on how the component renders.
 * See https://storybook.js.org/docs/api/csf
 * to learn how to use render functions.
 */
export const OneItem: Story = {
  render: (args) => (
    <List {...args}>
      <ListItem />
    </List>
  ),
};

export const ManyItems: Story = {
  render: (args) => (
    <List {...args}>
      <ListItem />
      <ListItem />
      <ListItem />
    </List>
  ),
};
```

```js filename="List.stories.js|jsx" renderer="solid" language="js"
import { List } from './List';
import { ListItem } from './ListItem';

export default {
  component: List,
};

export const Empty = {};

/*
 *👇 Render functions are a framework specific feature to allow you control on how the component renders.
 * See https://storybook.js.org/docs/api/csf
 * to learn how to use render functions.
 */
export const OneItem = {
  render: (args) => (
    <List {...args}>
      <ListItem />
    </List>
  ),
};

export const ManyItems = {
  render: (args) => (
    <List {...args}>
      <ListItem />
      <ListItem />
      <ListItem />
    </List>
  ),
};
```

```tsx filename="List.stories.ts|tsx" renderer="solid" language="ts-4-9"
import type { Meta, StoryObj } from 'storybook-solidjs';

import { List } from './List';
import { ListItem } from './ListItem';

const meta = {
  component: List,
} satisfies Meta<typeof List>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {};

/*
 *👇 Render functions are a framework specific feature to allow you control on how the component renders.
 * See https://storybook.js.org/docs/api/csf
 * to learn how to use render functions.
 */
export const OneItem: Story = {
  render: (args) => (
    <List {...args}>
      <ListItem />
    </List>
  ),
};

export const ManyItems: Story = {
  render: (args) => (
    <List {...args}>
      <ListItem />
      <ListItem />
      <ListItem />
    </List>
  ),
};
```

```tsx filename="List.stories.ts|tsx" renderer="solid" language="ts"
import type { Meta, StoryObj } from 'storybook-solidjs';

import { List } from './List';
import { ListItem } from './ListItem';

const meta: Meta<typeof List> = {
  component: List,
};

export default meta;
type Story = StoryObj<typeof List>;

export const Empty: Story = {};

/*
 *👇 Render functions are a framework specific feature to allow you control on how the component renders.
 * See https://storybook.js.org/docs/api/csf
 * to learn how to use render functions.
 */
export const OneItem: Story = {
  render: (args) => (
    <List {...args}>
      <ListItem />
    </List>
  ),
};

export const ManyItems: Story = {
  render: (args) => (
    <List {...args}>
      <ListItem />
      <ListItem />
      <ListItem />
    </List>
  ),
};
```

```svelte filename="List.stories.svelte" renderer="svelte" language="js" tabTitle="Svelte CSF"
<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf';

  import List from './List.svelte';
  import ListItem from './ListItem.svelte';

  const { Story } = defineMeta({
    component: List,
  });
</script>

<Story name="Empty" />

<Story name="One Item">
  {#snippet children(args)}
    <List {...args} >
      <ListItem />
    </List>
  {/snippet}
</Story>

<Story name="Many Items">
  {#snippet children(args)}
    <List {...args} >
      <ListItem />
      <ListItem />
      <ListItem />
    </List>
  {/snippet}
</Story>
```

```svelte filename="List.stories.svelte" renderer="svelte" language="ts-4-9" tabTitle="Svelte CSF"
<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf';

  import List from './List.svelte';
  import ListItem from './ListItem.svelte';

  const { Story } = defineMeta({
    component: List,
  });
</script>

<Story name="Empty" />

<Story name="One Item">
  {#snippet children(args)}
    <List {...args} >
      <ListItem />
    </List>
  {/snippet}
</Story>

<Story name="Many Items">
  {#snippet children(args)}
    <List {...args} >
      <ListItem />
      <ListItem />
      <ListItem />
    </List>
  {/snippet}
</Story>
```

```svelte filename="List.stories.svelte" renderer="svelte" language="ts" tabTitle="Svelte CSF"
<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf';

  import List from './List.svelte';
  import ListItem from './ListItem.svelte';

  const { Story } = defineMeta({
    component: List,
  });
</script>

<Story name="Empty" />

<Story name="One Item">
  {#snippet children(args)}
    <List {...args} >
      <ListItem />
    </List>
  {/snippet}
</Story>

<Story name="Many Items">
  {#snippet children(args)}
    <List {...args} >
      <ListItem />
      <ListItem />
      <ListItem />
    </List>
  {/snippet}
</Story>
```

```js filename="List.stories.js" renderer="vue" language="js"
import List from './ListComponent.vue';
import ListItem from './ListItem.vue';

export default {
  component: List,
};

/*
 *👇 Render functions are a framework specific feature to allow you control on how the component renders.
 * See https://storybook.js.org/docs/api/csf
 * to learn how to use render functions.
 */
export const Empty = {
  render: () => ({
    components: { List },
    template: '<List/>',
  }),
};

export const OneItem = {
  render: () => ({
    components: { List, ListItem },
    template: `
      <List>
        <list-item/>
      </List>`,
  }),
};

export const ManyItems = {
  render: () => ({
    components: { List, ListItem },
    template: `
      <List>
        <list-item/>
        <list-item/>
        <list-item/>
      </List>`,
  }),
};
```

```ts filename="List.stories.ts" renderer="vue" language="ts-4-9"
import type { Meta, StoryObj } from '@storybook/vue3';

import List from './ListComponent.vue';
import ListItem from './ListItem.vue';

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
export const Empty: Story = {
  render: () => ({
    components: { List },
    template: '<List/>',
  }),
};

export const OneItem: Story = {
  render: () => ({
    components: { List, ListItem },
    template: `
      <List>
        <list-item/>
      </List>`,
  }),
};

export const ManyItems: Story = {
  render: (args) => ({
    components: { List, ListItem },
    template: `
      <List>
        <list-item/>
        <list-item/>
        <list-item/>
      </List>`,
  }),
};
```

```ts filename="List.stories.ts" renderer="vue" language="ts"
import type { Meta, StoryObj } from '@storybook/vue3';

import List from './ListComponent.vue';
import ListItem from './ListItem.vue';

const meta: Meta<typeof List> = {
  component: List,
};

export default meta;
type Story = StoryObj<typeof List>;

/*
 *👇 Render functions are a framework specific feature to allow you control on how the component renders.
 * See https://storybook.js.org/docs/api/csf
 * to learn how to use render functions.
 */
export const Empty: Story = {
  render: () => ({
    components: { List },
    template: '<List/>',
  }),
};

export const OneItem: Story = {
  render: () => ({
    components: { List, ListItem },
    template: `
      <List>
        <list-item/>
      </List>`,
  }),
};

export const ManyItems: Story = {
  render: () => ({
    components: { List, ListItem },
    template: `
      <List>
        <list-item/>
        <list-item/>
        <list-item/>
      </List>`,
  }),
};
```

```js filename="List.stories.js" renderer="web-components" language="js"
import { html } from 'lit';

export default {
  component: 'demo-list',
};

export const Empty = {
  render: () => html`<demo-list></demo-list>`,
};

export const OneItem = {
  render: () => html`
    <demo-list>
      <demo-list-item></demo-list-item>
    </demo-list>
  `,
};

export const ManyItems = {
  render: () => html`
    <demo-list>
      <demo-list-item></demo-list-item>
      <demo-list-item></demo-list-item>
      <demo-list-item></demo-list-item>
    </demo-list>
  `,
};
```

```ts filename="List.stories.ts" renderer="web-components" language="ts"
import type { Meta, StoryObj } from '@storybook/web-components';

import { html } from 'lit';

const meta: Meta = {
  component: 'demo-list',
};

export default meta;
type Story = StoryObj;

export const Empty: Story = {
  render: () => html`<demo-list></demo-list>`,
};

export const OneItem: Story = {
  render: () => html`
    <demo-list>
      <demo-list-item></demo-list-item>
    </demo-list>
  `,
};

export const ManyItems: Story = {
  render: () => html`
    <demo-list>
      <demo-list-item></demo-list-item>
      <demo-list-item></demo-list-item>
      <demo-list-item></demo-list-item>
    </demo-list>
  `,
};
```
