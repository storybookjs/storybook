```ts filename="LoginForm.stories.ts" renderer="common" language="ts"
// Replace your-framework with the name of your framework (e.g. react-vite, vue3-vite, angular, etc.)
import type { Meta, StoryObj } from '@storybook/your-framework';
import { fn, expect } from '@storybook/test';

import { LoginForm } from './LoginForm';

const meta = {
  component: LoginForm,
  args: {
    // 👇 Use `fn` to spy on the onSubmit arg
    onSubmit: fn(),
  },
} satisfies Meta<typeof LoginForm>;
export default meta;

type Story = StoryObj<typeof meta>;

export const FilledForm: Story = {
  play: async ({ args, canvas, userEvent }) => {
    await userEvent.type(canvas.getByLabelText('Email'), 'email@provider.com');
    await userEvent.type(canvas.getByLabelText('Password'), 'a-random-password');
    await userEvent.click(canvas.getByRole('button', { name: 'Log in' }));

    // 👇 Now we can assert that the onSubmit arg was called
    await expect(args.onSubmit).toHaveBeenCalled();
  },
};
```

```js filename="LoginForm.stories.js" renderer="common" language="js"
import { fn, expect } from '@storybook/test';

import { LoginForm } from './LoginForm';

export default {
  component: LoginForm,
  args: {
    // 👇 Use `fn` to spy on the onSubmit arg
    onSubmit: fn(),
  },
};

export const FilledForm = {
  play: async ({ args, canvas, userEvent }) => {
    await userEvent.type(canvas.getByLabelText('Email'), 'email@provider.com');
    await userEvent.type(canvas.getByLabelText('Password'), 'a-random-password');
    await userEvent.click(canvas.getByRole('button', { name: 'Log in' }));

    // 👇 Now we can assert that the onSubmit arg was called
    await expect(args.onSubmit).toHaveBeenCalled();
  },
};
```
