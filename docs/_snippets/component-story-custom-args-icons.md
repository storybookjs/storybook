```ts filename="Icon.stories.ts" renderer="angular" language="ts"
import type { Meta, StoryObj } from '@storybook/angular';

import Icon from './icon.component';

import { IconA, IconB, IconC, IconD, IconE } from './icons';

// Maps the icons to a JSON serializable object to be safely used with the argTypes
const iconMap = { IconA, IconB, IconC, IconD, IconE };

const meta: Meta<Icon> = {
  title: 'My Story with Icons',
  component: Icon,
  argTypes: {
    icon: {
      options: Object.keys(iconMap),
    },
  },
};

export default meta;
type Story = StoryObj<Icon>;

const Template: Story = (args) => {
  // retrieves the appropriate icon passes it as a component prop
  const { icon } = args;
  const selectedIcon = iconMap[icon];
  return {
    component: Icon,
    props: {
      ...args,
      icon: selectedIcon,
    },
  };
};
```
