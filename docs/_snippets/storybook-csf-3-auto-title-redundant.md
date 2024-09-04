```ts filename="components/MyComponent/MyComponent.stories.ts" renderer="angular" language="ts"
import type { Meta, StoryObj } from '@storybook/angular';

import { MyComponent } from './MyComponent.component';

const meta: Meta<MyComponent> = {
  /* 👇 The title prop is optional.
   * See https://storybook.js.org/docs/configure/#configure-story-loading
   * to learn how to generate automatic titles
   */
  component: MyComponent,
  title: 'components/MyComponent/MyComponent',
};

export default meta;
type Story = StoryObj<MyComponent>;

export const Default: Story = {
  args: {
    something: 'Something else',
  },
};
```

```js filename="components/MyComponent/MyComponent.stories.js|jsx" renderer="common" language="js"
import { MyComponent } from './MyComponent';

export default {
  component: MyComponent,
  title: 'components/MyComponent/MyComponent',
};

export const Default = {
  args: {
    something: 'Something else',
  },
};
```

```ts filename="components/MyComponent/MyComponent.stories.js|jsx" renderer="common" language="ts-4-9"
// Replace your-framework with the name of your framework
import type { Meta, StoryObj } from '@storybook/your-framework';

import { MyComponent } from './MyComponent';

const meta = {
  /* 👇 The title prop is optional.
   * See https://storybook.js.org/docs/configure/#configure-story-loading
   * to learn how to generate automatic titles
   */
  component: MyComponent,
  title: 'components/MyComponent/MyComponent',
} satisfies Meta<typeof MyComponent>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    something: 'Something else',
  },
};
```

```ts filename="components/MyComponent/MyComponent.stories.ts|tsx" renderer="common" language="ts"
// Replace your-framework with the name of your framework
import type { Meta, StoryObj } from '@storybook/your-framework';

import { MyComponent } from './MyComponent';

const meta: Meta<typeof MyComponent> = {
  /* 👇 The title prop is optional.
   * See https://storybook.js.org/docs/configure/#configure-story-loading
   * to learn how to generate automatic titles
   */
  component: MyComponent,
  title: 'components/MyComponent/MyComponent',
};

export default meta;
type Story = StoryObj<typeof MyComponent>;

export const Default: Story = {
  args: {
    something: 'Something else',
  },
};
```

```js filename="components/MyComponent/MyComponent.stories.js" renderer="web-components" language="js"
export default {
  component: 'my-component',
  title: 'components/MyComponent/MyComponent',
};

export const Default = {
  args: {
    something: 'Something else',
  },
};
```

```ts filename="components/MyComponent/MyComponent.stories.ts" renderer="web-components" language="ts"
import type { Meta, StoryObj } from '@storybook/web-components';

const meta: Meta = {
  component: 'my-component',
  title: 'components/MyComponent/MyComponent',
};

export default meta;
type Story = StoryObj;

export const Default: Story = {
  args: {
    something: 'Something else',
  },
};
```

