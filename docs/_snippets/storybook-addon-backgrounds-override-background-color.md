```ts filename="Button.stories.ts" renderer="angular" language="ts" tabTitle="globals-api"
import type { Meta, StoryObj } from '@storybook/angular';

import { Button } from './button.component';

const meta: Meta<Button> = {
  component: Button,
};

export default meta;
type Story = StoryObj<Button>;

export const Large: Story = {
  parameters: {
    backgrounds: {
      options: {
        dark: { name: 'Dark', value: '#000' },
      },
    },
  },
};
```

```ts filename="Button.stories.ts" renderer="angular" language="ts" tabTitle="without-globals"
import type { Meta, StoryObj } from '@storybook/angular';

import { Button } from './button.component';

const meta: Meta<Button> = {
  component: Button,
};

export default meta;
type Story = StoryObj<Button>;

export const Large: Story = {
  parameters: {
    backgrounds: { default: 'Dark' },
  },
};
```

```js filename="Button.stories.js" renderer="web-components" language="js" tabTitle="globals-api"
export default {
  component: 'demo-button',
};

export const Large = {
  parameters: {
    backgrounds: {
      options: {
        dark: { name: 'Dark', value: '#000' },
      },
    },
  },
};
```

```js filename="Button.stories.js" renderer="web-components" language="js" tabTitle="without-globals"
export default {
  component: 'demo-button',
};

export const Large = {
  parameters: {
    backgrounds: { default: 'Dark' },
  },
};
```

```ts filename="Button.stories.ts" renderer="web-components" language="ts" tabTitle="globals-api"
import type { Meta, StoryObj } from '@storybook/web-components';

const meta: Meta = {
  component: 'demo-button',
};

export default meta;
type Story = StoryObj;

export const Large: Story = {
  parameters: {
    backgrounds: {
      options: {
        dark: { name: 'Dark', value: '#000' },
      },
    },
  },
};
```

```ts filename="Button.stories.ts" renderer="web-components" language="ts" tabTitle="without-globals"
import type { Meta, StoryObj } from '@storybook/web-components';

const meta: Meta = {
  component: 'demo-button',
};

export default meta;
type Story = StoryObj;

export const Large: Story = {
  parameters: {
    backgrounds: { default: 'Dark' },
  },
};
```

```js filename="Button.stories.js|jsx" renderer="react" language="js" tabTitle="globals-api"
import { Button } from './Button';

export default {
  component: Button,
};

export const Large = {
  parameters: {
    backgrounds: {
      options: {
        dark: { name: 'Dark', value: '#000' },
      },
    },
  },
};
```

```js filename="Button.stories.js|jsx" renderer="react" language="js" tabTitle="without-globals"
import { Button } from './Button';

export default {
  component: Button,
};

export const Large = {
  parameters: {
    backgrounds: { default: 'Dark' },
  },
};
```

```ts filename="Button.stories.tsx" renderer="react" language="ts" tabTitle="globals-api"
import type { Meta, StoryObj } from '@storybook/react';

import { Button } from './Button';

const meta: Meta<typeof Button> = {
  component: Button,
};

export default meta;
type Story = StoryObj<typeof Button>;

export const Large: Story = {
  parameters: {
    backgrounds: {
      options: {
        dark: { name: 'Dark', value: '#000' },
      },
    },
  },
};
```

```ts filename="Button.stories.tsx" renderer="react" language="ts" tabTitle="without-globals"
import type { Meta, StoryObj } from '@storybook/react';

import { Button } from './Button';

const meta: Meta<typeof Button> = {
  component: Button,
};

export default meta;
type Story = StoryObj<typeof Button>;

export const Large: Story = {
  parameters: {
    backgrounds: { default: 'Dark' },
  },
};
```

```ts filename="Button.stories.ts|tsx" renderer="react" language="ts-4-9" tabTitle="globals-api"
import type { Meta, StoryObj } from '@storybook/react';

import { Button } from './Button';

const meta = {
  component: Button,
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Large: Story = {
  parameters: {
    backgrounds: {
      options: {
        dark: { name: 'Dark', value: '#000' },
      },
    },
  },
};
```

```ts filename="Button.stories.ts|tsx" renderer="react" language="ts-4-9" tabTitle="without-globals"
import type { Meta, StoryObj } from '@storybook/react';

import { Button } from './Button';

const meta = {
  component: Button,
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Large: Story = {
  parameters: {
    backgrounds: { default: 'Dark' },
  },
};
```

```js filename="Button.stories.js" renderer="vue" language="js" tabTitle="globals-api"
import Button from './Button.vue';

export default {
  component: Button,
};

export const Large = {
  parameters: {
    backgrounds: {
      options: {
        dark: { name: 'Dark', value: '#000' },
      },
    },
  },
};
```

```js filename="Button.stories.js" renderer="vue" language="js" tabTitle="without-globals"
import Button from './Button.vue';

export default {
  component: Button,
};

export const Large = {
  parameters: {
    backgrounds: { default: 'Dark' },
  },
};
```

```ts filename="Button.stories.ts" renderer="vue" language="ts" tabTitle="globals-api"
import type { Meta, StoryObj } from '@storybook/vue3';

import Button from './Button.vue';

const meta: Meta<typeof Button> = {
  component: Button,
};

export default meta;
type Story = StoryObj<typeof Button>;

export const Large: Story = {
  parameters: {
    backgrounds: {
      options: {
        dark: { name: 'Dark', value: '#000' },
      },
    },
  },
};
```

```ts filename="Button.stories.ts" renderer="vue" language="ts" tabTitle="without-globals"
import type { Meta, StoryObj } from '@storybook/vue3';

import Button from './Button.vue';

const meta: Meta<typeof Button> = {
  component: Button,
};

export default meta;
type Story = StoryObj<typeof Button>;

export const Large: Story = {
  parameters: {
    backgrounds: { default: 'Dark' },
  },
};
```

```ts filename="Button.stories.ts" renderer="vue" language="ts-4-9" tabTitle="globals-api"
import type { Meta, StoryObj } from '@storybook/vue3';

import Button from './Button.vue';

const meta = {
  component: Button,
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Large: Story = {
  parameters: {
    backgrounds: {
      options: {
        dark: { name: 'Dark', value: '#000' },
      },
    },
  },
};
```

```ts filename="Button.stories.ts" renderer="vue" language="ts-4-9" tabTitle="without-globals"
import type { Meta, StoryObj } from '@storybook/vue3';

import Button from './Button.vue';

const meta = {
  component: Button,
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Large: Story = {
  parameters: {
    backgrounds: { default: 'Dark' },
  },
};
```

```js filename="Button.stories.js" renderer="svelte" language="js" tabTitle="globals-api"
import Button from './Button.svelte';

export default {
  component: Button,
};

export const Large = {
  parameters: {
    backgrounds: {
      options: {
        dark: { name: 'Dark', value: '#000' },
      },
    },
  },
};
```

```js filename="Button.stories.js" renderer="svelte" language="js" tabTitle="without-globals"
import Button from './Button.svelte';

export default {
  component: Button,
};

export const Large = {
  parameters: {
    backgrounds: { default: 'Dark' },
  },
};
```

```ts filename="Button.stories.ts" renderer="svelte" language="ts" tabTitle="globals-api"
import type { Meta, StoryObj } from '@storybook/svelte';

import Button from './Button.svelte';

const meta: Meta<typeof Button> = {
  component: Button,
};

export default meta;
type Story = StoryObj<typeof Button>;

export const Large: Story = {
  parameters: {
    backgrounds: {
      options: {
        dark: { name: 'Dark', value: '#000' },
      },
    },
  },
};
```

```ts filename="Button.stories.ts" renderer="svelte" language="ts" tabTitle="without-globals"
import type { Meta, StoryObj } from '@storybook/svelte';

import Button from './Button.svelte';

const meta: Meta<typeof Button> = {
  component: Button,
};

export default meta;
type Story = StoryObj<typeof Button>;

export const Large: Story = {
  parameters: {
    backgrounds: { default: 'Dark' },
  },
};
```

```ts filename="Button.stories.ts" renderer="svelte" language="ts-4-9" tabTitle="globals-api"
import type { Meta, StoryObj } from '@storybook/svelte';

import Button from './Button.svelte';

const meta = {
  component: Button,
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Large: Story = {
  parameters: {
    backgrounds: {
      options: {
        dark: { name: 'Dark', value: '#000' },
      },
    },
  },
};
```

```ts filename="Button.stories.ts" renderer="svelte" language="ts-4-9" tabTitle="without-globals"
import type { Meta, StoryObj } from '@storybook/svelte';

import Button from './Button.svelte';

const meta = {
  component: Button,
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Large: Story = {
  parameters: {
    backgrounds: { default: 'Dark' },
  },
};
```
