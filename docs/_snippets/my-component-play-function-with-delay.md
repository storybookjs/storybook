```ts filename="MyComponent.stories.ts" renderer="angular" language="ts"
import type { Meta, StoryObj } from '@storybook/angular';

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
export const DelayedStory: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    const exampleElement = canvas.getByLabelText('example-element');

    // The delay option sets the amount of milliseconds between characters being typed
    await userEvent.type(exampleElement, 'random string', {
      delay: 100,
    });

    const AnotherExampleElement = canvas.getByLabelText('another-example-element');
    await userEvent.type(AnotherExampleElement, 'another random string', {
      delay: 100,
    });
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
export const DelayedStory = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    const exampleElement = canvas.getByLabelText('example-element');

    // The delay option sets the amount of milliseconds between characters being typed
    await userEvent.type(exampleElement, 'random string', {
      delay: 100,
    });

    const AnotherExampleElement = canvas.getByLabelText('another-example-element');
    await userEvent.type(AnotherExampleElement, 'another random string', {
      delay: 100,
    });
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

/* See https://storybook.js.org/docs/7/writing-stories/play-function#working-with-the-canvasas
 * to learn more about using the canvasElement to query the DOM
 */
export const DelayedStory: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    const exampleElement = canvas.getByLabelText('example-element');

    // The delay option sets the amount of milliseconds between characters being typed
    await userEvent.type(exampleElement, 'random string', {
      delay: 100,
    });

    const AnotherExampleElement = canvas.getByLabelText('another-example-element');
    await userEvent.type(AnotherExampleElement, 'another random string', {
      delay: 100,
    });
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
export const DelayedStory: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    const exampleElement = canvas.getByLabelText('example-element');

    // The delay option sets the amount of milliseconds between characters being typed
    await userEvent.type(exampleElement, 'random string', {
      delay: 100,
    });

    const AnotherExampleElement = canvas.getByLabelText('another-example-element');
    await userEvent.type(AnotherExampleElement, 'another random string', {
      delay: 100,
    });
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
export const DelayedStory = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    const exampleElement = canvas.getByLabelText('example-element');

    // The delay option sets the amount of milliseconds between characters being typed
    await userEvent.type(exampleElement, 'random string', {
      delay: 100,
    });

    const AnotherExampleElement = canvas.getByLabelText('another-example-element');
    await userEvent.type(AnotherExampleElement, 'another random string', {
      delay: 100,
    });
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
export const DelayedStory: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    const exampleElement = canvas.getByLabelText('example-element');

    // The delay option sets the amount of milliseconds between characters being typed
    await userEvent.type(exampleElement, 'random string', {
      delay: 100,
    });

    const AnotherExampleElement = canvas.getByLabelText('another-example-element');
    await userEvent.type(AnotherExampleElement, 'another random string', {
      delay: 100,
    });
  },
};
```
