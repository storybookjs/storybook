```ts filename="EventForm.stories.ts" renderer="common" language="ts"
// Replace your-framework with the name of your framework (e.g. react-vite, vue3-vite, angular, etc.)
import type { Meta, StoryObj } from '@storybook/your-framework';
import { fn, expect } from '@storybook/test';

import { users } from '#mocks';
import { EventForm } from './EventForm';

const meta = {
  component: EventForm,
} satisfies Meta<typeof EventForm>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Submits: Story = {
  // Mock functions so we can manipulate and spy on them
  args: {
    getUsers: fn(),
    onSubmit: fn(),
  },
  beforeEach: async ({ args }) => {
    // Manipulate `getUsers` mock to return mocked value
    args.getUsers.mockResolvedValue(users);
  },
  play: async ({ args, canvas, userEvent }) => {
    const usersList = canvas.getAllByRole('listitem');
    await expect(usersList).toHaveLength(4);
    await expect(canvas.getAllByText('VIP')).toHaveLength(2);

    const titleInput = await canvas.findByLabelText('Enter a title for your event');
    await userEvent.type(titleInput, 'Holiday party');

    const submitButton = canvas.getByRole('button', { text: 'Plan event' });
    await userEvent.click(submitButton);

    // Spy on `onSubmit` to verify that it is called correctly
    await expect(args.onSubmit).toHaveBeenCalledWith({
      name: 'Holiday party',
      userCount: 4,
      data: expect.anything(),
    });
  },
};
```

```js filename="EventForm.stories.js" renderer="common" language="js"
import { fn, expect } from 'storybook/test';

import { users } from '#mocks';
import { EventForm } from './EventForm';

export default {
  component: EventForm,
};

export const Submits = {
  // Mock functions so we can manipulate and spy on them
  args: {
    getUsers: fn(),
    onSubmit: fn(),
  },
  beforeEach: async ({ args }) => {
    // Manipulate `getUsers` mock to return mocked value
    args.getUsers.mockResolvedValue(users);
  },
  play: async ({ args, canvas, userEvent }) => {
    const usersList = canvas.getAllByRole('listitem');
    await expect(usersList).toHaveLength(4);
    await expect(canvas.getAllByText('VIP')).toHaveLength(2);

    const titleInput = await canvas.findByLabelText('Enter a title for your event');
    await userEvent.type(titleInput, 'Holiday party');

    const submitButton = canvas.getByRole('button', { text: 'Plan event' });
    await userEvent.click(submitButton);

    // Spy on `onSubmit` to verify that it is called correctly
    await expect(args.onSubmit).toHaveBeenCalledWith({
      name: 'Holiday party',
      userCount: 4,
      data: expect.anything(),
    });
  },
};
```
