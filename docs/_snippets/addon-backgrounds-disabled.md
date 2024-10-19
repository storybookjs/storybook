```js filename="Button.stories.js|jsx" renderer="common" language="js" tabTitle="Without globals API"
import { Button } from './Button';

export default {
  component: Button,
};

export const Large = {
  parameters: {
    backgrounds: { disable: true },
  },
};
```

```js filename="Button.stories.js|jsx" renderer="common" language="js" tabTitle="With globals API"
import { Button } from './Button';

export default {
  component: Button,
};

export const Large = {
  parameters: {
    backgrounds: { disabled: true },
  },
};
```

```ts filename="Button.stories.ts|tsx" renderer="common" language="ts-4-9" tabTitle="Without globals API"
// Replace your-renderer with the renderer you are using (e.g., react, vue3, angular, etc.)
import { Meta, StoryObj } from '@storybook/your-renderer';

import { Button } from './Button';

const meta = {
  component: Button,
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Large: Story = {
  parameters: {
    backgrounds: { disable: true },
  },
};
```

```ts filename="Button.stories.ts|tsx" renderer="common" language="ts-4-9" tabTitle="With globals API"
// Replace your-renderer with the renderer you are using (e.g., react, vue3, angular, etc.)
import { Meta, StoryObj } from '@storybook/your-renderer';

import { Button } from './Button';

const meta = {
  component: Button,
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Large: Story = {
  parameters: {
    backgrounds: { disabled: true },
  },
};
```

```ts filename="Button.stories.ts|tsx" renderer="common" language="ts" tabTitle="Without globals API"
// Replace your-renderer with the renderer you are using (e.g., react, vue3, angular, etc.)
import { Meta, StoryObj } from '@storybook/your-renderer';

import { Button } from './Button';

const meta: Meta<typeof Button> = {
  component: Button,
};

export default meta;
type Story = StoryObj<typeof Button>;

export const Large: Story = {
  parameters: {
    backgrounds: { disable: true },
  },
};
```

```ts filename="Button.stories.ts|tsx" renderer="common" language="ts" tabTitle="With globals API"
// Replace your-renderer with the renderer you are using (e.g., react, vue3, angular, etc.)
import { Meta, StoryObj } from '@storybook/your-renderer';

import { Button } from './Button';

const meta: Meta<typeof Button> = {
  component: Button,
};

export default meta;
type Story = StoryObj<typeof Button>;

export const Large: Story = {
  parameters: {
    backgrounds: { disabled: true },
  },
};
```
