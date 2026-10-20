```js filename="lit-slots-and-css.stories.js" renderer="web-components" language="js"
import { html } from 'lit';

import './lit-slots-and-css';

export default {
  component: 'lit-slots-and-css',
};

export const CustomMarkup = {
  render: (args) =>
    html`<lit-slots-and-css heading=${args.heading}
      ><p>Default slot content</p>
      <button slot="actions">Confirm</button></lit-slots-and-css
    >`,
  args: {
    heading: 'Hello',
  },
};
```

```ts filename="lit-slots-and-css.stories.ts" renderer="web-components" language="ts"
import { html } from 'lit';
import type { Meta, StoryObj } from '@storybook/web-components-vite';

import './lit-slots-and-css';

const meta = {
  component: 'lit-slots-and-css',
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const CustomMarkup: Story = {
  render: (args) =>
    html`<lit-slots-and-css heading=${args.heading}
      ><p>Default slot content</p>
      <button slot="actions">Confirm</button></lit-slots-and-css
    >`,
  args: {
    heading: 'Hello',
  },
};
```
