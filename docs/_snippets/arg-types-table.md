```ts filename="Example.stories.ts" renderer="angular" language="ts"
import type { Meta } from '@storybook/angular';

import { Example } from './Example';

const meta: Meta<Example> = {
  component: Example,
  argTypes: {
    value: {
      table: {
        defaultValue: { summary: 0 },
        type: { summary: 'number' },
      },
    },
  },
};

export default meta;
```

```js filename="Example.stories.js|jsx" renderer="common" language="js"
import { Example } from './Example';

export default {
  component: Example,
  argTypes: {
    value: {
      table: {
        defaultValue: { summary: 0 },
        type: { summary: 'number' },
      },
    },
  },
};
```

```ts filename="Example.stories.ts|tsx" renderer="common" language="ts-4-9"
// Replace your-renderer with the renderer you are using (e.g., react, vue3, angular, etc.)
import type { Meta } from '@storybook/your-renderer';

import { Example } from './Example';

const meta = {
  component: Example,
  argTypes: {
    value: {
      table: {
        defaultValue: { summary: 0 },
        type: { summary: 'number' },
      },
    },
  },
} satisfies Meta<typeof Example>;

export default meta;
```

```ts filename="Example.stories.ts|tsx" renderer="common" language="ts"
// Replace your-renderer with the renderer you are using (e.g., react, vue3, angular, etc.)
import type { Meta } from '@storybook/your-renderer';

import { Example } from './Example';

const meta: Meta<typeof Example> = {
  component: Example,
  argTypes: {
    value: {
      table: {
        defaultValue: { summary: 0 },
        type: { summary: 'number' },
      },
    },
  },
};

export default meta;
```

```js filename="Example.stories.js" renderer="web-components" language="js"
export default {
  component: 'demo-example',
  argTypes: {
    value: {
      table: {
        defaultValue: { summary: 0 },
        type: { summary: 'number' },
      },
    },
  },
};
```

```ts filename="Example.stories.ts" renderer="web-components" language="ts"
import type { Meta } from '@storybook/web-components';

const meta: Meta = {
  component: 'demo-example',
  argTypes: {
    value: {
      table: {
        defaultValue: { summary: 0 },
        type: { summary: 'number' },
      },
    },
  },
};

export default meta;
```
