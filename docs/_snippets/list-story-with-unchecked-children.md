```js filename="List.stories.js|jsx" renderer="react" language="js"
import { List } from './List';

//👇 Instead of importing ListItem, we import the stories
import { Unchecked } from './ListItem.stories';

export default {
  /* 👇 The title prop is optional.
   * See https://storybook.js.org/docs/configure/#configure-story-loading
   * to learn how to generate automatic titles
   */
  title: 'List',
  component: List,
};

export const OneItem = {
  args: {
    children: <Unchecked {...Unchecked.args} />,
  },
};
```

```ts filename="List.stories.ts|tsx" renderer="react" language="ts-4-9"
import type { Meta, StoryObj } from '@storybook/react';

import { List } from './List';

//👇 Instead of importing ListItem, we import the stories
import { Unchecked } from './ListItem.stories';

const meta = {
  /* 👇 The title prop is optional.
   * See https://storybook.js.org/docs/configure/#configure-story-loading
   * to learn how to generate automatic titles
   */
  title: 'List',
  component: List,
} satisfies Meta<typeof List>;

export default meta;
type Story = StoryObj<typeof meta>;

export const OneItem: Story = {
  args: {
    children: <Unchecked {...Unchecked.args} />,
  },
};
```

```ts filename="List.stories.ts|tsx" renderer="react" language="ts"
import type { Meta, StoryObj } from '@storybook/react';

import { List } from './List';

//👇 Instead of importing ListItem, we import the stories
import { Unchecked } from './ListItem.stories';

const meta: Meta<typeof List> = {
  /* 👇 The title prop is optional.
   * See https://storybook.js.org/docs/configure/#configure-story-loading
   * to learn how to generate automatic titles
   */
  title: 'List',
  component: List,
};

export default meta;
type Story = StoryObj<typeof List>;

export const OneItem: Story = {
  args: {
    children: <Unchecked {...Unchecked.args} />,
  },
};
```

```js filename="List.stories.js|jsx" renderer="solid" language="js"
import { List } from './List';

//👇 Instead of importing ListItem, we import the stories
import { Unchecked } from './ListItem.stories';

export default {
  /* 👇 The title prop is optional.
   * See https://storybook.js.org/docs/configure/#configure-story-loading
   * to learn how to generate automatic titles
   */
  title: 'List',
  component: List,
};

export const OneItem = {
  args: {
    children: <Unchecked {...Unchecked.args} />,
  },
};
```

```tsx filename="List.stories.ts|tsx" renderer="solid" language="ts-4-9"
import type { Meta, StoryObj } from 'storybook-solidjs';

import { List } from './List';

//👇 Instead of importing ListItem, we import the stories
import { Unchecked } from './ListItem.stories';

const meta = {
  /* 👇 The title prop is optional.
   * See https://storybook.js.org/docs/configure/#configure-story-loading
   * to learn how to generate automatic titles
   */
  title: 'List',
  component: List,
} satisfies Meta<typeof List>;

export default meta;
type Story = StoryObj<typeof meta>;

export const OneItem: Story = {
  args: {
    children: <Unchecked {...Unchecked.args} />,
  },
};
```

```tsx filename="List.stories.ts|tsx" renderer="solid" language="ts"
import type { Meta, StoryObj } from 'storybook-solidjs';

import { List } from './List';

//👇 Instead of importing ListItem, we import the stories
import { Unchecked } from './ListItem.stories';

const meta: Meta<typeof List> = {
  /* 👇 The title prop is optional.
   * See https://storybook.js.org/docs/configure/#configure-story-loading
   * to learn how to generate automatic titles
   */
  title: 'List',
  component: List,
};

export default meta;
type Story = StoryObj<typeof List>;

export const OneItem: Story = {
  args: {
    children: <Unchecked {...Unchecked.args} />,
  },
};
```

