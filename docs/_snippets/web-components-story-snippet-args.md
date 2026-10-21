```js filename="lit-slots-and-css.stories.js" renderer="web-components" language="js" tabTitle="CSF Next 🧪"
import preview from '../.storybook/preview';

import './lit-slots-and-css';

const meta = preview.meta({
  component: 'lit-slots-and-css',
});

export const Basic = meta.story({
  args: {
    heading: 'Hello',
    'default-slot': 'Body <b>text</b>',
    'actions-slot': '<button>Confirm</button>',
    'panel-part': 'color: rebeccapurple;',
    '--slot-panel-color': 'teal',
  },
});
```

```ts filename="lit-slots-and-css.stories.ts" renderer="web-components" language="ts" tabTitle="CSF Next 🧪"
import preview from '../.storybook/preview';

import './lit-slots-and-css';

const meta = preview.meta({
  component: 'lit-slots-and-css',
});

export const Basic = meta.story({
  args: {
    heading: 'Hello',
    'default-slot': 'Body <b>text</b>',
    'actions-slot': '<button>Confirm</button>',
    'panel-part': 'color: rebeccapurple;',
    '--slot-panel-color': 'teal',
  },
});
```

```js filename="lit-slots-and-css.stories.js" renderer="web-components" language="js" tabTitle="CSF 3"
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

```ts filename="lit-slots-and-css.stories.ts" renderer="web-components" language="ts" tabTitle="CSF 3"
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
