```ts filename="Button.stories.ts" renderer="angular" language="ts"
import type { Meta, StoryObj } from '@storybook/angular';

import { Button } from './button.component';

const meta: Meta<Button> = {
  component: Button,
  globals: {
    // 👇 Set viewport for all component stories
    viewport: { value: 'tablet', isRotated: false },
  },
};

export default meta;
type Story = StoryObj<Button>;

export const OnPhone: Story = {
  globals: {
    // 👇 Override viewport for this story
    viewport: { value: 'mobile1', isRotated: false },
  },
};
```

```js filename="Button.stories.js|jsx" renderer="common" language="js"
import { Button } from './Button';

export default {
  component: Button,
  globals: {
    // 👇 Set viewport for all component stories
    viewport: { value: 'tablet', isRotated: false },
  },
};

export const OnPhone = {
  globals: {
    // 👇 Override viewport for this story
    viewport: { value: 'mobile1', isRotated: false },
  },
};
```

```ts filename="Button.stories.ts|tsx" renderer="common" language="ts-4-9"
// Replace your-renderer with the renderer you are using (e.g., react, vue3, angular, etc.)
import type { Meta, StoryObj } from '@storybook/your-renderer';

import { Button } from './Button';

const meta = {
  component: Button,
  globals: {
    // 👇 Set viewport for all component stories
    viewport: { value: 'tablet', isRotated: false },
  },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const OnPhone: Story = {
  globals: {
    // 👇 Override viewport for this story
    viewport: { value: 'mobile1', isRotated: false },
  },
};
```

```ts filename="Button.stories.ts|tsx" renderer="common" language="ts"
// Replace your-renderer with the renderer you are using (e.g., react, vue3, angular, etc.)
import type { Meta, StoryObj } from '@storybook/your-renderer';

import { Button } from './Button';

const meta: Meta<typeof Button> = {
  component: Button,
  globals: {
    // 👇 Set viewport for all component stories
    viewport: { value: 'tablet', isRotated: false },
  },
};

export default meta;
type Story = StoryObj<typeof Button>;

export const OnPhone: Story = {
  globals: {
    // 👇 Override viewport for this story
    viewport: { value: 'mobile1', isRotated: false },
  },
};
```

```js filename="Button.stories.js" renderer="web-components" language="js"
export default {
  component: 'demo-button',
  globals: {
    // 👇 Set viewport for all component stories
    viewport: { value: 'tablet', isRotated: false },
  },
};

export const OnPhone = {
  globals: {
    // 👇 Override viewport for this story
    viewport: { value: 'mobile1', isRotated: false },
  },
};
```

```ts filename="Button.stories.ts" renderer="web-components" language="ts"
import type { Meta, StoryObj } from '@storybook/web-components';

const meta: Meta = {
  component: 'demo-button',
  globals: {
    // 👇 Set viewport for all component stories
    viewport: { value: 'tablet', isRotated: false },
  },
};

export default meta;
type Story = StoryObj;

export const OnPhone: Story = {
  globals: {
    // 👇 Override viewport for this story
    viewport: { value: 'mobile1', isRotated: false },
  },
};
```
