```jsx filename="List.stories.js|jsx" renderer="react" language="js" tabTitle="CSF 3"
import { List } from './List';

//👇 Instead of importing ListItem, we import the stories
import { Unchecked } from './ListItem.stories';

export default {
  component: List,
};

export const OneItem = {
  render: ({ children, ...args }) => <List {...args}>{children}</List>,
  args: {
    //👇 In CSF 3, call the reused story's render function (it is not a component)
    children: Unchecked.render({ ...Unchecked.args }),
  },
};
```

```tsx filename="List.stories.ts|tsx" renderer="react" language="ts" tabTitle="CSF 3"
// Replace your-framework with the framework you are using, e.g. react-vite, nextjs, nextjs-vite, etc.
import type { Meta, StoryObj } from '@storybook/your-framework';

import { List } from './List';

//👇 Instead of importing ListItem, we import the stories
import { Unchecked } from './ListItem.stories';

const meta = {
  component: List,
} satisfies Meta<typeof List>;

export default meta;
type Story = StoryObj<typeof meta>;

export const OneItem: Story = {
  render: ({ children, ...args }) => <List {...args}>{children}</List>,
  args: {
    //👇 In CSF 3, call the reused story's render function (it is not a component)
    children: Unchecked.render({ ...Unchecked.args }),
  },
};
```

```jsx filename="List.stories.js|jsx" renderer="solid" language="js"
import { List } from './List';

//👇 Instead of importing ListItem, we import the stories
import { Unchecked } from './ListItem.stories';

export default {
  component: List,
};

export const OneItem = {
  render: ({ children, ...args }) => <List {...args}>{children}</List>,
  args: {
    children: Unchecked.render({ ...Unchecked.args }),
  },
};
```

```tsx filename="List.stories.ts|tsx" renderer="solid" language="ts"
import type { Meta, StoryObj } from 'storybook-solidjs-vite';

import { List } from './List';

//👇 Instead of importing ListItem, we import the stories
import { Unchecked } from './ListItem.stories';

const meta = {
  component: List,
} satisfies Meta<typeof List>;

export default meta;
type Story = StoryObj<typeof meta>;

export const OneItem: Story = {
  render: ({ children, ...args }) => <List {...args}>{children}</List>,
  args: {
    children: Unchecked.render({ ...Unchecked.args }),
  },
};
```

```tsx filename="List.stories.ts|tsx" renderer="react" language="ts" tabTitle="CSF Next 🧪"
import preview from '../.storybook/preview';

import { List } from './List';

//👇 Instead of importing ListItem, we import the stories
import { Unchecked } from './ListItem.stories';

const meta = preview.meta({
  component: List,
});

export const OneItem = meta.story({
  render: ({ children, ...args }) => <List {...args}>{children}</List>,
  args: {
    children: Unchecked.render({ ...Unchecked.input.args }),
  },
});
```

<!-- JS snippets still needed while providing both CSF 3 & Next -->

```jsx filename="List.stories.js|jsx" renderer="react" language="js" tabTitle="CSF Next 🧪"
import preview from '../.storybook/preview';

import { List } from './List';

//👇 Instead of importing ListItem, we import the stories
import { Unchecked } from './ListItem.stories';

const meta = preview.meta({
  component: List,
});

export const OneItem = meta.story({
  render: ({ children, ...args }) => <List {...args}>{children}</List>,
  args: {
    children: Unchecked.render({ ...Unchecked.input.args }),
  },
});
```
