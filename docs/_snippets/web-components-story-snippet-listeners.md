```js filename="lit-events.stories.js" renderer="web-components" language="js"
import './lit-events';

export default {
  component: 'lit-events',
};

export const WithListener = {
  args: {
    value: 'changed',
    'my-change-event': () => {},
  },
};
```

```ts filename="lit-events.stories.ts" renderer="web-components" language="ts"
import type { Meta, StoryObj } from '@storybook/web-components-vite';

import './lit-events';

const meta = {
  component: 'lit-events',
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const WithListener: Story = {
  args: {
    value: 'changed',
    'my-change-event': () => {},
  },
};
```
