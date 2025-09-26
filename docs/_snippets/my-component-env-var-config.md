```ts filename="MyComponent.stories.ts" renderer="angular" language="ts"
import type { Meta, StoryObj } from '@storybook/angular';

import { MyComponent } from './MyComponent';

// To apply a set of backgrounds to all stories of Button:
const meta: Meta<MyComponent> = {
  component: MyComponent,
};

export default meta;
type Story = StoryObj<MyComponent>;

export const Default: Story = {
  args: {
    exampleProp: process.env.EXAMPLE_VAR,
  },
};
```

```js filename="MyComponent.stories.js|jsx" renderer="common" language="js" tabTitle="CSF 3"
import { MyComponent } from './MyComponent';

export default {
  component: MyComponent,
};

export const Default = {
  args: {
    exampleProp: process.env.EXAMPLE_VAR,
  },
};
```

```ts filename="MyComponent.stories.ts|tsx" renderer="common" language="ts" tabTitle="CSF 3"
// Replace your-framework with the framework you are using, e.g. react-vite, nextjs, vue3-vite, etc.
import type { Meta, StoryObj } from '@storybook/your-framework';

import { MyComponent } from './MyComponent';

const meta = {
  component: MyComponent,
} satisfies Meta<typeof MyComponent>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    exampleProp: process.env.EXAMPLE_VAR,
  },
};
```

```js filename="MyComponent.stories.js" renderer="web-components" language="js"
export default {
  component: 'my-component',
};

export const Default = {
  args: {
    exampleProp: process.env.EXAMPLE_VAR,
  },
};
```

```ts filename="MyComponent.stories.ts" renderer="web-components" language="ts"
import type { Meta, StoryObj } from '@storybook/web-components-vite';

const meta: Meta = {
  component: 'my-component',
};

export default meta;
type Story = StoryObj;

export const Default: Story = {
  args: {
    exampleProp: process.env.EXAMPLE_VAR,
  },
};
```

```ts filename="MyComponent.stories.ts|tsx" renderer="react" language="ts" tabTitle="CSF Next 🧪"
import preview from '../.storybook/preview';

import { MyComponent } from './MyComponent';

const meta = preview.meta({
  component: MyComponent,
});

export const Default = meta.story({
  args: {
    exampleProp: process.env.EXAMPLE_VAR,
  },
});
```

<!-- JS snippets still needed while providing both CSF 3 & Next -->

```js filename="MyComponent.stories.js|jsx" renderer="react" language="js" tabTitle="CSF Next 🧪"
import preview from '../.storybook/preview';
import { MyComponent } from './MyComponent';

const meta = preview.meta({
  component: MyComponent,
});

export const Default = meta.story({
  args: {
    exampleProp: process.env.EXAMPLE_VAR,
  },
});
```
