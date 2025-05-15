```ts filename="MyComponent.stories.ts" renderer="angular" language="ts"
import type { Meta, StoryObj } from '@storybook/angular';

import { MyComponent } from './MyComponent.component';

const meta: Meta<MyComponent> = {
  component: MyComponent,
};
export default meta;

type Story = StoryObj<MyComponent>;

/*
 * See https://storybook.js.org/docs/writing-stories/play-function#working-with-the-canvas
 * to learn more about using the canvas to query the DOM
 */
export const FirstStory: Story = {
  play: async ({ canvas, userEvent }) => {
    await userEvent.type(canvas.getByTestId('an-element'), 'example-value');
  },
};

export const SecondStory: Story = {
  play: async ({ canvas, userEvent }) => {
    await userEvent.type(canvas.getByTestId('other-element'), 'another value');
  },
};

export const CombinedStories: Story = {
  play: async ({ context, canvas, userEvent }) => {
    // Runs the FirstStory and Second story play function before running this story's play function
    await FirstStory.play(context);
    await SecondStory.play(context);
    await userEvent.type(canvas.getByTestId('another-element'), 'random value');
  },
};
```

```js filename="MyComponent.stories.js|jsx" renderer="common" language="js"
import { MyComponent } from './MyComponent';

export default {
  component: MyComponent,
};

/*
 * See https://storybook.js.org/docs/writing-stories/play-function#working-with-the-canvas
 * to learn more about using the canvas to query the DOM
 */
export const FirstStory = {
  play: async ({ canvas, userEvent }) => {
    await userEvent.type(canvas.getByTestId('an-element'), 'example-value');
  },
};

export const SecondStory = {
  play: async ({ canvas, userEvent }) => {
    await userEvent.type(canvas.getByTestId('other-element'), 'another value');
  },
};

export const CombinedStories = {
  play: async ({ context, canvas, userEvent }) => {
    // Runs the FirstStory and Second story play function before running this story's play function
    await FirstStory.play(context);
    await SecondStory.play(context);
    await userEvent.type(canvas.getByTestId('another-element'), 'random value');
  },
};
```

```ts filename="MyComponent.stories.ts|tsx" renderer="common" language="ts"
// Replace your-framework with the framework you are using (e.g., react-vite, vue3-vite, angular, etc.)
import type { Meta, StoryObj } from '@storybook/your-framework';

import { MyComponent } from './MyComponent';

const meta = {
  component: MyComponent,
} satisfies Meta<typeof MyComponent>;
export default meta;

type Story = StoryObj<typeof meta>;

/*
 * See https://storybook.js.org/docs/writing-stories/play-function#working-with-the-canvas
 * to learn more about using the canvas to query the DOM
 */
export const FirstStory: Story = {
  play: async ({ canvas, userEvent }) => {
    await userEvent.type(canvas.getByTestId('an-element'), 'example-value');
  },
};

export const SecondStory: Story = {
  play: async ({ canvas, userEvent }) => {
    await userEvent.type(canvas.getByTestId('other-element'), 'another value');
  },
};

export const CombinedStories: Story = {
  play: async ({ context, canvas, userEvent }) => {
    // Runs the FirstStory and Second story play function before running this story's play function
    await FirstStory.play(context);
    await SecondStory.play(context);
    await userEvent.type(canvas.getByTestId('another-element'), 'random value');
  },
};
```

```js filename="MyComponent.stories.js" renderer="web-components" language="js"
export default {
  component: 'demo-my-component',
};

/*
 * See https://storybook.js.org/docs/writing-stories/play-function#working-with-the-canvas
 * to learn more about using the canvas to query the DOM
 */
export const FirstStory = {
  play: async ({ canvas, userEvent }) => {
    await userEvent.type(canvas.getByTestId('an-element'), 'example-value');
  },
};

export const SecondStory = {
  play: async ({ canvas, userEvent }) => {
    await userEvent.type(canvas.getByTestId('other-element'), 'another value');
  },
};

export const CombinedStories = {
  play: async ({ context, canvas, userEvent }) => {
    // Runs the FirstStory and Second story play function before running this story's play function
    await FirstStory.play(context);
    await SecondStory.play(context);
    await userEvent.type(canvas.getByTestId('another-element'), 'random value');
  },
};
```

```ts filename="MyComponent.stories.ts" renderer="web-components" language="ts"
import type { Meta, StoryObj } from '@storybook/web-components-vite';
const meta: Meta = {
  component: 'demo-my-component',
};
export default meta;

type Story = StoryObj;

/*
 * See https://storybook.js.org/docs/writing-stories/play-function#working-with-the-canvas
 * to learn more about using the canvas to query the DOM
 */
export const FirstStory: Story = {
  play: async ({ canvas, userEvent }) => {
    await userEvent.type(canvas.getByTestId('an-element'), 'example-value');
  },
};

export const SecondStory: Story = {
  play: async ({ canvas, userEvent }) => {
    await userEvent.type(canvas.getByTestId('other-element'), 'another value');
  },
};

export const CombinedStories: Story = {
  play: async ({ context, canvas, userEvent }) => {
    // Runs the FirstStory and Second story play function before running this story's play function
    await FirstStory.play(context);
    await SecondStory.play(context);
    await userEvent.type(canvas.getByTestId('another-element'), 'random value');
  },
};
```
