```ts filename="Dialog.stories.ts" renderer="common" language="ts"
// Replace your-framework with the name of your framework (e.g. react-vite, vue3-vite, angular, etc.)
import type { Meta, StoryObj } from '@storybook/your-framework';
import { expect } from '@storybook/test';

import { Dialog } from './Dialog';

const meta = {
  component: Dialog,
} satisfies Meta<typeof Dialog>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Opens: Story = {
  play: async ({ canvas, userEvent }) => {
    // Click on a button and assert that a dialog appears
    const button = canvas.getByRole('button', { text: 'Open Modal' });
    await userEvent.click(button);
    await expect(canvas.getByRole('dialog')).toBeInTheDocument();
  },
};
```

```js filename="Dialog.stories.js" renderer="common" language="js"
import { expect } from 'storybook/test';

import { Dialog } from './Dialog';

export default {
  component: Dialog,
};

export const Opens = {
  play: async ({ canvas, userEvent }) => {
    // Click on a button and assert that a dialog appears
    const button = canvas.getByRole('button', { text: 'Open Modal' });
    await userEvent.click(button);
    await expect(canvas.getByRole('dialog')).toBeInTheDocument();
  },
};
```
