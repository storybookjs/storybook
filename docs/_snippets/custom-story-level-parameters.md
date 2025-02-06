```ts filename="Dialog.stories.ts" renderer="angular" language="ts"
import type { Meta, StoryObj } from '@storybook/angular';

import { Dialog } from './dialog.component';

const meta: Meta<Dialog> = {
  component: Dialog,
  // 👇 Meta-level parameters
  parameters: {
    layout: 'fullscreen',
    demo: {
      demoProperty: 'b',
      anotherDemoProperty: 'b',
    },
  },
};

export default meta;
type Story = StoryObj<typeof Dialog>;

// (no additional parameters specified)
export const Basic: Story = {};

export const LargeScreen: Story = {
  // 👇 Story-level parameters
  parameters: {
    layout: 'padded',
    demo: {
      demoArray: [3, 4],
    },
  },
};
```

```js filename="Dialog.stories.js|jsx" renderer="common" language="js" tabTitle="CSF 3"
import { Dialog } from './Dialog';

export default {
  component: Dialog,
  // 👇 Meta-level parameters
  parameters: {
    layout: 'fullscreen',
    demo: {
      demoProperty: 'b',
      anotherDemoProperty: 'b',
    },
  },
};

// (no additional parameters specified)
export const Basic = {};

export const LargeScreen = {
  // 👇 Story-level parameters
  parameters: {
    layout: 'padded',
    demo: {
      demoArray: [3, 4],
    },
  },
};
```

```js filename="Dialog.stories.js|jsx" renderer="react" language="js" tabTitle="CSF Factory 🧪"
// Learn about the # subpath import: https://storybook.js.org/docs/api/csf/csf-factories#subpath-imports
import preview from '#.storybook/preview';

import { Dialog } from './Dialog';

const meta = preview.meta({
  component: Dialog,
  // 👇 Meta-level parameters
  parameters: {
    layout: 'fullscreen',
    demo: {
      demoProperty: 'b',
      anotherDemoProperty: 'b',
    },
  },
});

// (no additional parameters specified)
export const Basic = meta.story({});

export const LargeScreen = meta.story({
  // 👇 Story-level parameters
  parameters: {
    layout: 'padded',
    demo: {
      demoArray: [3, 4],
    },
  },
});
```

```ts filename="Dialog.stories.ts|tsx" renderer="common" language="ts-4-9" tabTitle="CSF 3"
// Replace your-renderer with the renderer you are using (e.g., react, vue3, angular, etc.)
import type { Meta } from '@storybook/your-renderer';

import { Dialog } from './Dialog';

const meta = {
  component: Dialog,
  // 👇 Meta-level parameters
  parameters: {
    layout: 'fullscreen',
    demo: {
      demoProperty: 'b',
      anotherDemoProperty: 'b',
    },
  },
} satisfies Meta<typeof Dialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Basic: Story = {};

export const LargeScreen: Story = {
  // 👇 Story-level parameters
  parameters: {
    layout: 'padded',
    demo: {
      demoArray: [3, 4],
    },
  },
};
```

```ts filename="Dialog.stories.ts|tsx" renderer="react" language="ts-4-9" tabTitle="CSF Factory 🧪"
// Learn about the # subpath import: https://storybook.js.org/docs/api/csf/csf-factories#subpath-imports
import preview from '#.storybook/preview';

import { Dialog } from './Dialog';

const meta = preview.meta({
  component: Dialog,
  // 👇 Meta-level parameters
  parameters: {
    layout: 'fullscreen',
    demo: {
      demoProperty: 'b',
      anotherDemoProperty: 'b',
    },
  },
});

// (no additional parameters specified)
export const Basic = meta.story({});

export const LargeScreen = meta.story({
  // 👇 Story-level parameters
  parameters: {
    layout: 'padded',
    demo: {
      demoArray: [3, 4],
    },
  },
});
```

```ts filename="Dialog.stories.ts|tsx" renderer="common" language="ts" tabTitle="CSF 3"
// Replace your-renderer with the renderer you are using (e.g., react, vue3, angular, etc.)
import type { Meta, StoryObj } from '@storybook/your-renderer';

import { Dialog } from './Dialog';

const meta: Meta<typeof Dialog> = {
  component: Dialog,
  // 👇 Meta-level parameters
  parameters: {
    layout: 'fullscreen',
    demo: {
      demoProperty: 'b',
      anotherDemoProperty: 'b',
    },
  },
};

export default meta;
type Story = StoryObj<typeof Dialog>;

// (no additional parameters specified)
export const Basic: Story = {};

export const LargeScreen: Story = {
  // 👇 Story-level parameters
  parameters: {
    layout: 'padded',
    demo: {
      demoArray: [3, 4],
    },
  },
};
```

```ts filename="Dialog.stories.ts|tsx" renderer="react" language="ts" tabTitle="CSF Factory 🧪"
// Learn about the # subpath import: https://storybook.js.org/docs/api/csf/csf-factories#subpath-imports
import preview from '#.storybook/preview';

import { Dialog } from './Dialog';

const meta = preview.meta({
  component: Dialog,
  // 👇 Meta-level parameters
  parameters: {
    layout: 'fullscreen',
    demo: {
      demoProperty: 'b',
      anotherDemoProperty: 'b',
    },
  },
});

// (no additional parameters specified)
export const Basic = meta.story({});

export const LargeScreen = meta.story({
  // 👇 Story-level parameters
  parameters: {
    layout: 'padded',
    demo: {
      demoArray: [3, 4],
    },
  },
});
```

```js filename="Dialog.stories.js" renderer="web-components" language="js"
export default {
  component: 'demo-dialog',
  // 👇 Meta-level parameters
  parameters: {
    layout: 'fullscreen',
    demo: {
      demoProperty: 'b',
      anotherDemoProperty: 'b',
    },
  },
};

// (no additional parameters specified)
export const Basic = {};

export const LargeScreen = {
  // 👇 Story-level parameters
  parameters: {
    layout: 'padded',
    demo: {
      demoArray: [3, 4],
    },
  },
};
```

```ts filename="Dialog.stories.ts" renderer="web-components" language="ts"
import type { Meta, StoryObj } from '@storybook/web-components';

const meta: Meta = {
  component: 'demo-dialog',
  // 👇 Meta-level parameters
  parameters: {
    layout: 'fullscreen',
    demo: {
      demoProperty: 'b',
      anotherDemoProperty: 'b',
    },
  },
};

export default meta;
type Story = StoryObj;

// (no additional parameters specified)
export const Basic: Story = {};

export const LargeScreen: Story = {
  // 👇 Story-level parameters
  parameters: {
    layout: 'padded',
    demo: {
      demoArray: [3, 4],
    },
  },
};
```
