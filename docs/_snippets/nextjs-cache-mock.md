```js filename="MyForm.stories.js" renderer="react" language="js"
import { expect } from 'storybook/test';

/*
 * Replace your-framework with nextjs or nextjs-vite
 * 👇 Must include the `.mock` portion of filename to have mocks typed correctly
 */
import { revalidatePath } from '@storybook/your-framework/cache.mock';

import MyForm from './my-form';

export default {
  component: MyForm,
};

export const Submitted = {
  async play({ canvas, userEvent }) {
    const submitButton = canvas.getByRole('button', { name: /submit/i });
    await userEvent.click(saveButton);
    // 👇 Use any mock assertions on the function
    await expect(revalidatePath).toHaveBeenCalledWith('/');
  },
};
```

```ts filename="MyForm.stories.ts" renderer="react" language="ts"
// Replace your-framework with nextjs or nextjs-vite
import type { Meta, StoryObj } from '@storybook/your-framework';

import { expect } from 'storybook/test';

// 👇 Must include the `.mock` portion of filename to have mocks typed correctly
import { revalidatePath } from '@storybook/your-framework/cache.mock';

import MyForm from './my-form';

const meta = {
  component: MyForm,
} satisfies Meta<typeof MyForm>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Submitted: Story = {
  async play({ canvas, userEvent }) {
    const submitButton = canvas.getByRole('button', { name: /submit/i });
    await userEvent.click(saveButton);
    // 👇 Use any mock assertions on the function
    await expect(revalidatePath).toHaveBeenCalledWith('/');
  },
};
```
