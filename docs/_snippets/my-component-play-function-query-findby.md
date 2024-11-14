```ts filename="MyComponent.stories.ts" renderer="angular" language="ts"
import type { Meta, StoryObj } from '@storybook/your-framework';

import { userEvent, within } from '@storybook/testing-library';

import { MyComponent } from './MyComponent.component';

const meta: Meta<MyComponent> = {
  component: MyComponent,
};

export default meta;
type Story = StoryObj<MyComponent>;

/*
 * See https://storybook.js.org/docs/7/writing-stories/play-function#working-with-the-canvas
 * to learn more about using the canvasElement to query the DOM
 */
export const AsyncExample: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Other steps

    // Waits for the component to be rendered before querying the element
    await canvas.findByRole('button', { name: / button label/i });
  },
};
```

```js filename="MyComponent.stories.js|jsx" renderer="common" language="js"
import { userEvent, within } from '@storybook/testing-library';

import { MyComponent } from './MyComponent';

export default {
  component: MyComponent,
};

/* See https://storybook.js.org/docs/7/writing-stories/play-function#working-with-the-canvas
 * to learn more about using the canvasElement to query the DOM
 */
export const AsyncExample = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Other steps

    // Waits for the component to be rendered before querying the element
    await canvas.findByRole('button', { name: / button label/i }));
  },
};
```

```ts filename="MyComponent.stories.ts|tsx" renderer="common" language="ts-4-9"
// Replace your-framework with the name of your framework
import type { Meta, StoryObj } from '@storybook/your-framework';

import { userEvent, within } from '@storybook/testing-library';

import { MyComponent } from './MyComponent';

const meta = {
  component: MyComponent,
} satisfies Meta<typeof MyComponent>;

export default meta;
type Story = StoryObj<typeof meta>;

/* See https://storybook.js.org/docs/7/writing-stories/play-function#working-with-the-canvas
 * to learn more about using the canvasElement to query the DOM
 */
export const AsyncExample: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Other steps

    // Waits for the component to be rendered before querying the element
    await canvas.findByRole('button', { name: / button label/i });
  },
};
```

```ts filename="MyComponent.stories.ts|tsx" renderer="common" language="ts"
// Replace your-framework with the name of your framework
import type { Meta, StoryObj } from '@storybook/your-framework';

import { userEvent, within } from '@storybook/testing-library';

import { MyComponent } from './MyComponent';

const meta: Meta<typeof MyComponent> = {
  component: MyComponent,
};

export default meta;
type Story = StoryObj<typeof MyComponent>;

/* See https://storybook.js.org/docs/7/writing-stories/play-function#working-with-the-canvas
 * to learn more about using the canvasElement to query the DOM
 */
export const AsyncExample: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Other steps

    // Waits for the component to be rendered before querying the element
    await canvas.findByRole('button', { name: / button label/i });
  },
};
```

```js filename="MyComponent.stories.js" renderer="web-components" language="js"
import { userEvent, within } from '@storybook/testing-library';

export default {
  component: 'demo-my-component',
};

/* See https://storybook.js.org/docs/7/writing-stories/play-function#working-with-the-canvas
 * to learn more about using the canvasElement to query the DOM
 */
export const AsyncExample = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Other steps

    // Waits for the component to be rendered before querying the element
    await canvas.findByRole('button', { name: / button label/i }));
  },
};
```

```ts filename="MyComponent.stories.ts" renderer="web-components" language="ts"
import type { Meta, StoryObj } from '@storybook/web-components';
import { userEvent, within } from '@storybook/testing-library';

const meta: Meta = {
  component: 'demo-my-component',
};

export default meta;
type Story = StoryObj;

/* See https://storybook.js.org/docs/7/writing-stories/play-function#working-with-the-canvas
 * to learn more about using the canvasElement to query the DOM
 */
export const AsyncExample: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Other steps

    // Waits for the component to be rendered before querying the element
    await canvas.findByRole('button', { name: / button label/i });
  },
};
```
