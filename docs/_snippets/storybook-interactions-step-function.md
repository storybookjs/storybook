```ts filename="MyComponent.stories.ts" renderer="angular" language="ts"
import type { Meta, StoryObj } from '@storybook/angular';

import { userEvent, within } from '@storybook/test';

import { MyComponent } from './MyComponent.component';

const meta: Meta<MyComponent> = {
  component: MyComponent,
};

export default meta;
type Story = StoryObj<MyComponent>;

/*
 * See https://storybook.js.org/docs/writing-stories/play-function#working-with-the-canvas
 * to learn more about using the canvasElement to query the DOM
 */
export const Submitted: Story = {
  play: async ({ args, canvasElement, step }) => {
    const canvas = within(canvasElement);

    await step('Enter email and password', async () => {
      await userEvent.type(canvas.getByTestId('email'), 'hi@example.com');
      await userEvent.type(canvas.getByTestId('password'), 'supersecret');
    });

    await step('Submit form', async () => {
      await userEvent.click(canvas.getByRole('button'));
    });
  },
};
```

```js filename="MyComponent.stories.js|jsx" renderer="common" language="js"
import { userEvent, within } from '@storybook/test';

import { MyComponent } from './MyComponent';

export default {
  component: MyComponent,
};

/*
 * See https://storybook.js.org/docs/writing-stories/play-function#working-with-the-canvas
 * to learn more about using the canvasElement to query the DOM
 */
export const Submitted = {
  play: async ({ args, canvasElement, step }) => {
    const canvas = within(canvasElement);

    await step('Enter email and password', async () => {
      await userEvent.type(canvas.getByTestId('email'), 'hi@example.com');
      await userEvent.type(canvas.getByTestId('password'), 'supersecret');
    });

    await step('Submit form', async () => {
      await userEvent.click(canvas.getByRole('button'));
    });
  },
};
```

```ts filename="MyComponent.stories.ts" renderer="common" language="ts-4-9"
// Replace your-framework with the name of your framework
import type { Meta, StoryObj } from '@storybook/your-framework';

import { userEvent, within } from '@storybook/test';

import { MyComponent } from './MyComponent';

const meta = {
  component: MyComponent,
} satisfies Meta<typeof MyComponent>;

export default meta;
type Story = StoryObj<typeof meta>;

/*
 * See https://storybook.js.org/docs/writing-stories/play-function#working-with-the-canvas
 * to learn more about using the canvasElement to query the DOM
 */
export const Submitted: Story = {
  play: async ({ args, canvasElement, step }) => {
    const canvas = within(canvasElement);

    await step('Enter email and password', async () => {
      await userEvent.type(canvas.getByTestId('email'), 'hi@example.com');
      await userEvent.type(canvas.getByTestId('password'), 'supersecret');
    });

    await step('Submit form', async () => {
      await userEvent.click(canvas.getByRole('button'));
    });
  },
};
```

```ts filename="MyComponent.stories.ts" renderer="common" language="ts"
// Replace your-framework with the name of your framework
import type { Meta, StoryObj } from '@storybook/your-framework';

import { userEvent, within } from '@storybook/test';

import { MyComponent } from './MyComponent';

const meta: Meta<typeof MyComponent> = {
  component: MyComponent,
};

export default meta;
type Story = StoryObj<typeof MyComponent>;

/*
 * See https://storybook.js.org/docs/writing-stories/play-function#working-with-the-canvas
 * to learn more about using the canvasElement to query the DOM
 */
export const Submitted: Story = {
  play: async ({ args, canvasElement, step }) => {
    const canvas = within(canvasElement);

    await step('Enter email and password', async () => {
      await userEvent.type(canvas.getByTestId('email'), 'hi@example.com');
      await userEvent.type(canvas.getByTestId('password'), 'supersecret');
    });

    await step('Submit form', async () => {
      await userEvent.click(canvas.getByRole('button'));
    });
  },
};
```

```js filename="MyComponent.stories.js" renderer="web-components" language="js"
import { userEvent, within } from '@storybook/test';

export default = {
  component: 'my-component',
};

/*
 * See https://storybook.js.org/docs/writing-stories/play-function#working-with-the-canvas
 * to learn more about using the canvasElement to query the DOM
 */
export const Submitted = {
  play: async ({ args, canvasElement, step }) => {
    const canvas = within(canvasElement);

    await step('Enter email and password', async () => {
      await userEvent.type(canvas.getByTestId('email'), 'hi@example.com');
      await userEvent.type(canvas.getByTestId('password'), 'supersecret');
    });

    await step('Submit form', async () => {
      await userEvent.click(canvas.getByRole('button'));
    });
  },
};
```

```ts filename="MyComponent.stories.ts" renderer="web-components" language="ts"
import type { Meta, StoryObj } from '@storybook/web-components';

import { userEvent, within } from '@storybook/test';

const meta: Meta = {
  title: 'MyComponent',
  component: 'my-component',
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

    await step('Enter email and password', async () => {
      await userEvent.type(canvas.getByTestId('email'), 'hi@example.com');
      await userEvent.type(canvas.getByTestId('password'), 'supersecret');
    });

    await step('Submit form', async () => {
      await userEvent.click(canvas.getByRole('button'));
    });
  },
};
```
