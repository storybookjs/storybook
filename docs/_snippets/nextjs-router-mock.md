```js filename="MyForm.stories.js" renderer="react" language="js"
import { expect, fireEvent, userEvent, within } from 'storybook/test';

// 👇 Must include the `.mock` portion of filename to have mocks typed correctly
import { getRouter } from '@storybook/nextjs-vite/router.mock';

import MyForm from './my-form';

export default {
  component: MyForm,
};

export const GoBack = {
  async play({ canvasElement }) {
    const canvas = within(canvasElement);
    const backBtn = await canvas.findByText('Go back');

    await userEvent.click(backBtn);
    // 👇 Assert that your component called back()
    await expect(getRouter().back).toHaveBeenCalled();
  },
};
```

```ts filename="MyForm.stories.ts" renderer="react" language="ts"
import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { expect, fireEvent, userEvent, within } from 'storybook/test';

// 👇 Must include the `.mock` portion of filename to have mocks typed correctly
import { getRouter } from '@storybook/nextjs-vite/router.mock';

import MyForm from './my-form';

const meta = {
  component: MyForm,
} satisfies Meta<typeof MyForm>;

export default meta;
type Story = StoryObj<typeof meta>;

export const GoBack: Story = {
  async play({ canvasElement }) {
    const canvas = within(canvasElement);
    const backBtn = await canvas.findByText('Go back');

    await userEvent.click(backBtn);
    // 👇 Assert that your component called back()
    await expect(getRouter().back).toHaveBeenCalled();
  },
};
```
