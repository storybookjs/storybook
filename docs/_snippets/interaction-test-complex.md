```ts filename="EventForm.stories.ts" renderer="angular" language="ts"
import type { Meta, StoryObj } from '@storybook/angular';
import { fn, expect } from 'storybook/test';

import { users } from '#mocks';
import { EventForm } from './EventForm.component';

const meta: Meta<EventForm> = {
  component: EventForm,
};
export default meta;

type Story = StoryObj<EventForm>;

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

```ts filename="EventForm.stories.ts" renderer="common" language="ts"
// Replace your-framework with the name of your framework (e.g. react-vite, vue3-vite, etc.)
import type { Meta, StoryObj } from '@storybook/your-framework';
import { fn, expect } from 'storybook/test';

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

```svelte filename="EventForm.stories.svelte" renderer="svelte" language="ts" tabTitle="Svelte CSF"
<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf';
  import { fn, expect } from 'storybook/test';

  import { users } from '#mocks';
  import { EventForm } from './EventForm.svelte';

  const { Story } = defineMeta({
    component: EventForm,
  });
</script>

<Story
  name="Submits"
  args={{
    // Mock functions so we can manipulate and spy on them
    getUsers: fn(),
    onSubmit: fn(),
  }}
  beforeEach={async ({ args }) => {
    // Manipulate `getUsers` mock to return mocked value
    args.getUsers.mockResolvedValue(users);
  }}
  play={async ({ args, canvas, userEvent }) => {
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
  }}
/>
```

```ts filename="EventForm.stories.ts" renderer="svelte" language="ts" tabTitle="CSF"
// Replace your-framework with the framework you are using, e.g. sveltekit or svelte-vite
import type { Meta, StoryObj } from '@storybook/your-framework';
import { fn, expect } from 'storybook/test';

import { users } from '#mocks';
import { EventForm } from './EventForm.svelte';

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

```svelte filename="EventForm.stories.svelte" renderer="svelte" language="js" tabTitle="Svelte CSF"
<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf';
  import { fn, expect } from 'storybook/test';

  import { users } from '#mocks';
  import { EventForm } from './EventForm.svelte';

  const { Story } = defineMeta({
    component: EventForm,
  });
</script>

<Story
  name="Submits"
  args={{
    // Mock functions so we can manipulate and spy on them
    getUsers: fn(),
    onSubmit: fn(),
  }}
  beforeEach={async ({ args }) => {
    // Manipulate `getUsers` mock to return mocked value
    args.getUsers.mockResolvedValue(users);
  }}
  play={async ({ args, canvas, userEvent }) => {
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
  }}
/>
```

```js filename="EventForm.stories.js" renderer="svelte" language="js" tabTitle="CSF"
import { fn, expect } from 'storybook/test';

import { users } from '#mocks';
import { EventForm } from './EventForm.svelte';

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

```ts filename="EventForm.stories.ts" renderer="web-components" language="ts"
import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { fn, expect } from 'storybook/test';

import { users } from '#mocks';

const meta: Meta = {
  component: 'demo-event-form',
};
export default meta;

type Story = StoryObj;

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

```js filename="EventForm.stories.js" renderer="web-components" language="js"
import { fn, expect } from 'storybook/test';

import { users } from '#mocks';

export default {
  component: 'demo-event-form',
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
