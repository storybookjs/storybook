```js filename="MyForm.stories.js" renderer="react" language="js"
import { expect, userEvent, within } from '@storybook/test';
import { revalidatePath } from '@storybook/nextjs/cache.mock';

import MyForm from './my-form';

export default {
  component: MyForm,
};

export const Submitted = {
  async play({ canvasElement }) {
    const canvas = within(canvasElement);

    const submitButton = canvas.getByRole('button', { name: /submit/i });
    await userEvent.click(saveButton);
    // 👇 Use any mock assertions on the function
    await expect(revalidatePath).toHaveBeenCalledWith('/');
  },
};
```

```ts filename="MyForm.stories.ts" renderer="react" language="ts-4-9"
import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, within } from '@storybook/test';
// 👇 Must include the `.mock` portion of filename to have mocks typed correctly
import { revalidatePath } from '@storybook/nextjs/cache.mock';

import MyForm from './my-form';

const meta = {
  component: MyForm,
} satisfies Meta<typeof MyForm>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Submitted: Story = {
  async play({ canvasElement }) {
    const canvas = within(canvasElement);

    const submitButton = canvas.getByRole('button', { name: /submit/i });
    await userEvent.click(saveButton);
    // 👇 Use any mock assertions on the function
    await expect(revalidatePath).toHaveBeenCalledWith('/');
  },
};
```

```ts filename="MyForm.stories.ts" renderer="react" language="ts"
import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, within } from '@storybook/test';
// 👇 Must include the `.mock` portion of filename to have mocks typed correctly
import { revalidatePath } from '@storybook/nextjs/cache.mock';

import MyForm from './my-form';

const meta: Meta<typeof MyForm> = {
  component: MyForm,
};

export default meta;

type Story = StoryObj<typeof MyForm>;

export const Submitted: Story = {
  async play({ canvasElement }) {
    const canvas = within(canvasElement);

    const submitButton = canvas.getByRole('button', { name: /submit/i });
    await userEvent.click(saveButton);
    // 👇 Use any mock assertions on the function
    await expect(revalidatePath).toHaveBeenCalledWith('/');
  },
};
```

