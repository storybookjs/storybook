```mdx filename="Component.mdx" renderer="common" language="mdx"
import { Meta, Story } from '@storybook/blocks';
import * as ComponentStories from './Component.stories';

<Meta of={ComponentStories} />

# Component Documentation

This component supports multiple themes. The stories below demonstrate how it looks in different themes.

Change the theme using the toolbar to see how the component adapts. The stories will automatically update.

<Story of={ComponentStories.LightTheme} />
<Story of={ComponentStories.DarkTheme} />
```

```tsx filename="Component.stories.tsx" renderer="react" language="ts"
import type { Meta, StoryObj } from '@storybook/react';
import { Component } from './Component';

const meta = {
  component: Component,
} satisfies Meta<typeof Component>;

export default meta;
type Story = StoryObj<typeof meta>;

export const LightTheme: Story = {
  globals: {
    theme: 'light',
  },
};

export const DarkTheme: Story = {
  globals: {
    theme: 'dark',
  },
};
```

