```js filename="lit-slots-and-css.stories.js" renderer="web-components" language="js"
import './lit-slots-and-css';

export default {
  component: 'lit-slots-and-css',
};

export const Basic = {
  args: {
    heading: 'Hello',
    'default-slot': 'Body <b>text</b>',
    'actions-slot': '<button>Confirm</button>',
    'panel-part': 'color: rebeccapurple;',
    '--slot-panel-color': 'teal',
  },
};
```

```ts filename="lit-slots-and-css.stories.ts" renderer="web-components" language="ts"
import type { Meta, StoryObj } from '@storybook/web-components-vite';

import './lit-slots-and-css';

const meta = {
  component: 'lit-slots-and-css',
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const Basic: Story = {
  args: {
    heading: 'Hello',
    'default-slot': 'Body <b>text</b>',
    'actions-slot': '<button>Confirm</button>',
    'panel-part': 'color: rebeccapurple;',
    '--slot-panel-color': 'teal',
  },
};
```
