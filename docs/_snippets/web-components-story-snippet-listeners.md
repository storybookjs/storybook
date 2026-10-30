```js filename="lit-events.stories.js" renderer="web-components" language="js" tabTitle="CSF 4"
import preview from '../.storybook/preview';

import './lit-events';

const meta = preview.meta({
  component: 'lit-events',
});

export const WithListener = meta.story({
  args: {
    value: 'changed',
    'my-change-event': () => {},
  },
});
```

```ts filename="lit-events.stories.ts" renderer="web-components" language="ts" tabTitle="CSF 4"
import preview from '../.storybook/preview';

import './lit-events';

const meta = preview.meta({
  component: 'lit-events',
});

export const WithListener = meta.story({
  args: {
    value: 'changed',
    'my-change-event': () => {},
  },
});
```

```js filename="lit-events.stories.js" renderer="web-components" language="js" tabTitle="CSF 3"
// ⚠️ CSF versions 1, 2, and 3 will be removed in a future version of Storybook. Upgrade to CSF 4: https://storybook.js.org/docs/writing-stories/csf#upgrade-to-csf-4
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

```ts filename="lit-events.stories.ts" renderer="web-components" language="ts" tabTitle="CSF 3"
// ⚠️ CSF versions 1, 2, and 3 will be removed in a future version of Storybook. Upgrade to CSF 4: https://storybook.js.org/docs/writing-stories/csf#upgrade-to-csf-4
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
