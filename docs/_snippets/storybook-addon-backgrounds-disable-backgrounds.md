```js filename="Button.stories.js|jsx" renderer="common" language="js" tabTitle="globals-api"
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

```js filename="Button.stories.js|jsx" renderer="common" language="js" tabTitle="without-globals"
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

```ts filename="Button.stories.ts|tsx" renderer="common" language="ts-4-9" tabTitle="globals-api"
// Replace your-framework with the name of your framework
import type { Meta, StoryObj } from '@storybook/your-framework';

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

```ts filename="Button.stories.ts|tsx" renderer="common" language="ts-4-9" tabTitle="without-globals"
// Replace your-framework with the name of your framework
import type { Meta, StoryObj } from '@storybook/your-framework';

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

```ts filename="Button.stories.ts|tsx" renderer="common" language="ts" tabTitle="globals-api"
// Replace your-framework with the name of your framework
import type { Meta, StoryObj } from '@storybook/your-framework';

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

```ts filename="Button.stories.ts|tsx" renderer="common" language="ts" tabTitle="without-globals"
// Replace your-framework with the name of your framework
import type { Meta, StoryObj } from '@storybook/your-framework';

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
