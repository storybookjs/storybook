```ts filename="Example.stories.ts" renderer="angular" language="ts"
import type { Meta } from '@storybook/angular';

import { Example } from './Example';

const meta: Meta<Example> = {
  component: Example,
  argTypes: {
    value: {
      description: 'The value of the slider',
    },
  },
};

export default meta;
```

```js filename="Example.stories.js|jsx" renderer="common" language="js" tabTitle="CSF 3"
import { Example } from './Example';

export default {
  component: Example,
  argTypes: {
    value: {
      description: 'The value of the slider',
    },
  },
};
```

```js filename="Example.stories.js|jsx" renderer="react" language="js" tabTitle="CSF Factory 🧪"
// Learn about the # subpath import: https://storybook.js.org/docs/api/csf/csf-factories#subpath-imports
import preview from '#.storybook/preview';

import { Example } from './Example';

const meta = preview.meta({
  component: Example,
  argTypes: {
    value: {
      description: 'The value of the slider',
    },
  },
});
```

```ts filename="Example.stories.ts|tsx" renderer="common" language="ts-4-9" tabTitle="CSF 3"
// Replace your-renderer with the renderer you are using (e.g., react, vue3, angular, etc.)
import type { Meta } from '@storybook/your-renderer';

import { Example } from './Example';

const meta = {
  component: Example,
  argTypes: {
    value: {
      description: 'The value of the slider',
    },
  },
} satisfies Meta<typeof Example>;

export default meta;
```

```ts filename="Example.stories.ts|tsx" renderer="react" language="ts-4-9" tabTitle="CSF Factory 🧪"
// Learn about the # subpath import: https://storybook.js.org/docs/api/csf/csf-factories#subpath-imports
import preview from '#.storybook/preview';

import { Example } from './Example';

const meta = preview.meta({
  component: Example,
  argTypes: {
    value: {
      description: 'The value of the slider',
    },
  },
});
```

```ts filename="Example.stories.ts|tsx" renderer="common" language="ts" tabTitle="CSF 3"
// Replace your-renderer with the renderer you are using (e.g., react, vue3, angular, etc.)
import type { Meta } from '@storybook/your-renderer';

import { Example } from './Example';

const meta: Meta<typeof Example> = {
  component: Example,
  argTypes: {
    value: {
      description: 'The value of the slider',
    },
  },
};

export default meta;
```

```ts filename="Example.stories.ts|tsx" renderer="react" language="ts" tabTitle="CSF Factory 🧪"
// Learn about the # subpath import: https://storybook.js.org/docs/api/csf/csf-factories#subpath-imports
import preview from '#.storybook/preview';

import { Example } from './Example';

const meta = preview.meta({
  component: Example,
  argTypes: {
    value: {
      description: 'The value of the slider',
    },
  },
});
```

```js filename="Example.stories.js" renderer="web-components" language="js"
export default {
  component: 'demo-example',
  argTypes: {
    value: {
      description: 'The value of the slider',
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
      description: 'The value of the slider',
    },
  },
};

export default meta;
```
