```ts filename="Button.stories.ts" renderer="angular" language="ts"
import type { Meta, StoryObj } from '@storybook/angular';

import { Button } from './button.component';

const meta: Meta<Button> = {
  component: Button,
};

export default meta;
type Story = StoryObj<Button>;

//👇 Throws a type error if the args don't match the component props
export const Primary: Story = {
  args: {
    primary: true,
  },
};
```

```ts filename="Button.stories.ts|tsx" renderer="common" language="ts"
// Replace your-framework with the name of your framework
import type { Meta, StoryObj } from '@storybook/your-framework';

import { Button } from './Button';

const meta: Meta<typeof Button> = {
  component: Button,
};

export default meta;
type Story = StoryObj<typeof Button>;

//👇 Throws a type error if the args don't match the component props
export const Primary: Story = {
  args: {
    primary: true,
  },
};
```

```ts filename="Button.stories.ts" renderer="web-components" language="ts"
import type { Meta, StoryObj } from '@storybook/web-components';

const meta: Meta = {
  component: 'demo-button',
};

export default meta;
type Story = StoryObj;

//👇 Throws a type error if the args don't match the component props
export const Primary: Story = {
  args: {
    primary: true,
  },
};
```
