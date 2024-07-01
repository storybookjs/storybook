```ts filename="Form.stories.ts" renderer="angular" language="ts"
import type { Meta, StoryObj } from '@storybook/angular';

import { userEvent, waitFor, within, expect, fn } from '@storybook/test';

import { Form } from './Form.component';

const meta: Meta<Form> = {
  component: MyComponent,
  args: {
    // 👇 Use `fn` to spy on the onSubmit arg
    onSubmit: fn(),
  },
};

export default meta;
type Story = StoryObj<Form>;

/*
 * See https://storybook.js.org/docs/writing-stories/play-function#working-with-the-canvas
 * to learn more about using the canvasElement to query the DOM
 */
export const Submitted: Story = {
  play: async ({ args, canvasElement, step }) => {
    const canvas = within(canvasElement);

    await step('Enter credentials', async () => {
      await userEvent.type(canvas.getByTestId('email'), 'hi@example.com');
      await userEvent.type(canvas.getByTestId('password'), 'supersecret');
    });

    await step('Submit form', async () => {
      await userEvent.click(canvas.getByRole('button'));
    });

    // 👇 Now we can assert that the onSubmit arg was called
    await waitFor(() => expect(args.onSubmit).toHaveBeenCalled());
  },
};
```

```js filename="Form.stories.js|jsx" renderer="common" language="js"
import { userEvent, waitFor, within, expect, fn } from '@storybook/test';

import { Form } from './Form';

export default {
  component: Form,
  args: {
    // 👇 Use `fn` to spy on the onSubmit arg
    onSubmit: fn(),
  },
};

/*
 * See https://storybook.js.org/docs/writing-stories/play-function#working-with-the-canvas
 * to learn more about using the canvasElement to query the DOM
 */
export const Submitted = {
  play: async ({ args, canvasElement, step }) => {
    // Starts querying the component from its root element
    const canvas = within(canvasElement);

    await step('Enter credentials', async () => {
      await userEvent.type(canvas.getByTestId('email'), 'hi@example.com');
      await userEvent.type(canvas.getByTestId('password'), 'supersecret');
    });

    await step('Submit form', async () => {
      await userEvent.click(canvas.getByRole('button'));
    });

    // 👇 Now we can assert that the onSubmit arg was called
    await waitFor(() => expect(args.onSubmit).toHaveBeenCalled());
  },
};
```

```ts filename="Form.stories.ts|tsx" renderer="common" language="ts-4-9"
// Replace your-framework with the name of your framework
import type { Meta, StoryObj } from '@storybook/your-framework';

import { userEvent, waitFor, within, expect, fn } from '@storybook/test';

import { Form } from './Form';

const meta = {
  component: Form,
  args: {
    // 👇 Use `fn` to spy on the onSubmit arg
    onSubmit: fn(),
  },
} satisfies Meta<typeof Form>;

export default meta;
type Story = StoryObj<typeof meta>;

/*
 * See https://storybook.js.org/docs/writing-stories/play-function#working-with-the-canvas
 * to learn more about using the canvasElement to query the DOM
 */
export const Submitted: Story = {
  play: async ({ args, canvasElement, step }) => {
    const canvas = within(canvasElement);

    await step('Enter credentials', async () => {
      await userEvent.type(canvas.getByTestId('email'), 'hi@example.com');
      await userEvent.type(canvas.getByTestId('password'), 'supersecret');
    });

    await step('Submit form', async () => {
      await userEvent.click(canvas.getByRole('button'));
    });

    // 👇 Now we can assert that the onSubmit arg was called
    await waitFor(() => expect(args.onSubmit).toHaveBeenCalled());
  },
};
```

```ts filename="Form.stories.ts|tsx" renderer="common" language="ts"
// Replace your-framework with the name of your framework
import type { Meta, StoryObj } from '@storybook/your-framework';

import { userEvent, waitFor, within, expect, fn } from '@storybook/test';

import { Form } from './Form';

const meta: Meta<typeof Form> = {
  component: Form,
  args: {
    // 👇 Use `fn` to spy on the onSubmit arg
    onSubmit: fn(),
  },
};

export default meta;
type Story = StoryObj<typeof Form>;

/*
 * See https://storybook.js.org/docs/writing-stories/play-function#working-with-the-canvas
 * to learn more about using the canvasElement to query the DOM
 */
export const Submitted: Story = {
  play: async ({ args, canvasElement, step }) => {
    const canvas = within(canvasElement);

    await step('Enter credentials', async () => {
      await userEvent.type(canvas.getByTestId('email'), 'hi@example.com');
      await userEvent.type(canvas.getByTestId('password'), 'supersecret');
    });

    await step('Submit form', async () => {
      await userEvent.click(canvas.getByRole('button'));
    });

    // 👇 Now we can assert that the onSubmit arg was called
    await waitFor(() => expect(args.onSubmit).toHaveBeenCalled());
  },
};
```

```js filename="Form.stories.js" renderer="web-components" language="js"
import { userEvent, waitFor, within, expect, fn } from '@storybook/test';

export default {
  component: 'my-form-element',
  args: {
    // 👇 Use `fn` to spy on the onSubmit arg
    onSubmit: fn(),
  },
};

/*
 * See https://storybook.js.org/docs/writing-stories/play-function#working-with-the-canvas
 * to learn more about using the canvasElement to query the DOM
 */
export const Submitted = {
  play: async ({ args, canvasElement, step }) => {
    const canvas = within(canvasElement);

    await step('Enter credentials', async () => {
      await userEvent.type(canvas.getByTestId('email'), 'hi@example.com');
      await userEvent.type(canvas.getByTestId('password'), 'supersecret');
    });

    await step('Submit form', async () => {
      await userEvent.click(canvas.getByRole('button'));
    });

    // 👇 Now we can assert that the onSubmit arg was called
    await waitFor(() => expect(args.onSubmit).toHaveBeenCalled());
  },
};
```

```ts filename="Form.stories.ts" renderer="web-components" language="ts"
import type { Meta, StoryObj } from '@storybook/web-components';

import { userEvent, waitFor, within, expect, fn } from '@storybook/test';

const meta: Meta = {
  component: 'my-form-element',
  args: {
    // 👇 Use `fn` to spy on the onSubmit arg
    onSubmit: fn(),
  },
};

export default meta;
type Story = StoryObj;

/*
 * See https://storybook.js.org/docs/writing-stories/play-function#working-with-the-canvas
 * to learn more about using the canvasElement to query the DOM
 */
export const Submitted: Story = {
  play: async ({ args, canvasElement, step }) => {
    const canvas = within(canvasElement);

    await step('Enter credentials', async () => {
      await userEvent.type(canvas.getByTestId('email'), 'hi@example.com');
      await userEvent.type(canvas.getByTestId('password'), 'supersecret');
    });

    await step('Submit form', async () => {
      await userEvent.click(canvas.getByRole('button'));
    });

    // 👇 Now we can assert that the onSubmit arg was called
    await waitFor(() => expect(args.onSubmit).toHaveBeenCalled());
  },
};
```

