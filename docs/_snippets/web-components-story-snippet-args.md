```js filename="lit-slots-and-css.stories.js" renderer="web-components" language="js"
export default {
  component: 'lit-slots-and-css',
};

export const Args = {
  args: {
    heading: 'Default render',
    'default-slot': 'Body <b>text</b>',
    'actions-slot': '<button>Confirm</button>',
    'panel-part': 'color: rebeccapurple;',
    '--slot-panel-color': 'teal',
  },
};
```

```ts filename="lit-slots-and-css.stories.ts" renderer="web-components" language="ts"
import type { Meta, StoryObj } from '@storybook/web-components-vite';

const meta = {
  component: 'lit-slots-and-css',
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const Args: Story = {
  args: {
    heading: 'Default render',
    'default-slot': 'Body <b>text</b>',
    'actions-slot': '<button>Confirm</button>',
    'panel-part': 'color: rebeccapurple;',
    '--slot-panel-color': 'teal',
  },
};
```
