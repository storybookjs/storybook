```ts filename="MyComponent.stories.ts" renderer="angular" language="ts"
import type { Meta, StoryObj } from '@storybook/angular';

import { userEvent, within } from '@storybook/test';

import { MyComponent } from './MyComponent.component';

const meta: Meta<MyComponent> = {
  component: MyComponent,
};

export default meta;
type Story = StoryObj<MyComponent>;

export const ExampleStory: Story = {
  play: async ({ canvasElement }) => {
    // Assigns canvas to the component root element
    const canvas = within(canvasElement);

    // Starts querying from the component's root element
    await userEvent.type(canvas.getByTestId('example-element'), 'something');
    await userEvent.click(canvas.getByRole('another-element'));
  },
};
```

```js filename="MyComponent.stories.js|jsx" renderer="common" language="js"
import { userEvent, within } from '@storybook/test';

import { MyComponent } from './MyComponent';

export default {
  component: MyComponent,
};

export const ExampleStory = {
  play: async ({ canvasElement }) => {
    // Assigns canvas to the component root element
    const canvas = within(canvasElement);

    // Starts querying from the component's root element
    await userEvent.type(canvas.getByTestId('example-element'), 'something');
    await userEvent.click(canvas.getByRole('another-element'));
  },
};
```

```ts filename="MyComponent.stories.ts|tsx" renderer="common" language="ts-4-9"
// Replace your-framework with the name of your framework
import type { Meta, StoryObj } from '@storybook/your-framework';

import { userEvent, within } from '@storybook/test';

import { MyComponent } from './MyComponent';

const meta = {
  component: MyComponent,
} satisfies Meta<typeof MyComponent>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ExampleStory: Story = {
  play: async ({ canvasElement }) => {
    // Assigns canvas to the component root element
    const canvas = within(canvasElement);

    // Starts querying from the component's root element
    await userEvent.type(canvas.getByTestId('example-element'), 'something');
    await userEvent.click(canvas.getByRole('another-element'));
  },
};
```

```ts filename="MyComponent.stories.ts|tsx" renderer="common" language="ts"
// Replace your-framework with the name of your framework
import type { Meta, StoryObj } from '@storybook/your-framework';

import { userEvent, within } from '@storybook/test';

import { MyComponent } from './MyComponent';

const meta: Meta<typeof MyComponent> = {
  component: MyComponent,
};

export default meta;
type Story = StoryObj<typeof MyComponent>;

export const ExampleStory: Story = {
  play: async ({ canvasElement }) => {
    // Assigns canvas to the component root element
    const canvas = within(canvasElement);

    // Starts querying from the component's root element
    await userEvent.type(canvas.getByTestId('example-element'), 'something');
    await userEvent.click(canvas.getByRole('another-element'));
  },
};
```

```js filename="MyComponent.stories.js" renderer="web-components" language="js"
import { userEvent, within } from '@storybook/test';

export default {
  component: 'demo-my-component',
};

export const ExampleStory = {
  play: async ({ canvasElement }) => {
    // Assigns canvas to the component root element
    const canvas = within(canvasElement);

    // Starts querying from the component's root element
    await userEvent.type(canvas.getByTestId('example-element'), 'something');
    await userEvent.click(canvas.getByRole('another-element'));
  },
};
```

```ts filename="MyComponent.stories.ts" renderer="web-components" language="ts"
import type { Meta, StoryObj } from '@storybook/web-components';
import { userEvent, within } from '@storybook/test';

const meta: Meta = {
  component: 'demo-my-component',
};

export default meta;
type Story = StoryObj;

export const ExampleStory: Story = {
  play: async ({ canvasElement }) => {
    // Assigns canvas to the component root element
    const canvas = within(canvasElement);

    // Starts querying from the component's root element
    await userEvent.type(canvas.getByTestId('example-element'), 'something');
    await userEvent.click(canvas.getByRole('another-element'));
  },
};
```

