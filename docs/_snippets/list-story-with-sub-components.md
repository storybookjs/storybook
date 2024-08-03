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

```ts filename="List.stories.ts" renderer="vue" language="ts-4-9"
import type { Meta, StoryObj } from '@storybook/vue3';

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

```ts filename="List.stories.ts" renderer="vue" language="ts"
import type { Meta, StoryObj } from '@storybook/vue3';

import List from './List.vue';
import ListItem from './ListItem.vue';

const meta: Meta<typeof List> = {
  component: List,
  subcomponents: { ListItem }, //👈 Adds the ListItem component as a subcomponent
};
export default meta;

type Story = StoryObj<typeof List>;

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

