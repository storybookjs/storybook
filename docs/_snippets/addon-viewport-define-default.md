```ts filename="Button.stories.ts" renderer="angular" language="ts"
import type { Meta, StoryObj } from '@storybook/angular';

import { Button } from './button.component';

const meta: Meta<Button> = {
  component: Button,
  parameters: {
    // 👇 Set default viewport for all component stories
    viewport: { defaultViewport: 'tablet' },
  },
};

export default meta;
type Story = StoryObj<Button>;

export const OnPhone: Story = {
  parameters: {
    // 👇 Override default viewport for this story
    viewport: { defaultViewport: 'mobile1' },
  },
};
```

```js filename="Button.stories.js|jsx" renderer="common" language="js"
import { Button } from './Button';

export default {
  component: Button,
  parameters: {
    // 👇 Set default viewport for all component stories
    viewport: { defaultViewport: 'tablet' },
  },
};

export const OnPhone = {
  parameters: {
    // 👇 Override default viewport for this story
    viewport: { defaultViewport: 'mobile1' },
  },
};
```

```ts filename="Button.stories.ts|tsx" renderer="common" language="ts-4-9"
// Replace your-framework with the name of your framework
import type { Meta, StoryObj } from '@storybook/your-framework';

import { Button } from './Button';

const meta = {
  component: Button,
  parameters: {
    // 👇 Set default viewport for all component stories
    viewport: { defaultViewport: 'tablet' },
  },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const OnPhone: Story = {
  parameters: {
    // 👇 Override default viewport for this story
    viewport: { defaultViewport: 'mobile1' },
  },
};
```

```ts filename="Button.stories.ts|tsx" renderer="common" language="ts"
// Replace your-framework with the name of your framework
import type { Meta, StoryObj } from '@storybook/your-framework';

import { Button } from './Button';

const meta: Meta<typeof Button> = {
  component: Button,
  parameters: {
    // 👇 Set default viewport for all component stories
    viewport: { defaultViewport: 'tablet' },
  },
};

export default meta;
type Story = StoryObj<typeof Button>;

export const OnPhone: Story = {
  parameters: {
    // 👇 Override default viewport for this story
    viewport: { defaultViewport: 'mobile1' },
  },
};
```

```js filename="Button.stories.js" renderer="web-components" language="js"
export default {
  component: 'demo-button',
  parameters: {
    // 👇 Set default viewport for all component stories
    viewport: { defaultViewport: 'tablet' },
  },
};

export const OnPhone = {
  parameters: {
    // 👇 Override default viewport for this story
    viewport: { defaultViewport: 'mobile1' },
  },
};
```

```ts filename="Button.stories.ts" renderer="web-components" language="ts"
import type { Meta, StoryObj } from '@storybook/web-components';

const meta: Meta = {
  component: 'demo-button',
  parameters: {
    // 👇 Set default viewport for all component stories
    viewport: { defaultViewport: 'tablet' },
  },
};

export default meta;
type Story = StoryObj;

export const OnPhone: Story = {
  parameters: {
    // 👇 Override default viewport for this story
    viewport: { defaultViewport: 'mobile1' },
  },
};
```
