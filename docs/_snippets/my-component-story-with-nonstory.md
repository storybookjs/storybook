<!-- TODO: Vet this API for CSF Factories -->

```ts filename="MyComponent.stories.ts" renderer="angular" language="ts"
import type { Meta, StoryObj } from '@storybook/angular';

import { MyComponent } from './MyComponent.component';

import someData from './data.json';

const meta: Meta<MyComponent> = {
  component: MyComponent,
  includeStories: ['SimpleStory', 'ComplexStory'], // 👈 Storybook loads these stories
  excludeStories: /.*Data$/, // 👈 Storybook ignores anything that contains Data
};

export default meta;

export const simpleData = { foo: 1, bar: 'baz' };
export const complexData = { foo: 1, foobar: { bar: 'baz', baz: someData } };

type Story = StoryObj<MyComponent>;

export const SimpleStory: Story = {
  args: {
    data: simpleData,
  },
};

export const ComplexStory: Story = {
  args: {
    data: complexData,
  },
};
```

```js filename="MyComponent.stories.js|jsx" renderer="react" language="js" tabTitle="CSF 3"
import { MyComponent } from './MyComponent';

import someData from './data.json';

export default {
  component: MyComponent,
  includeStories: ['SimpleStory', 'ComplexStory'], // 👈 Storybook loads these stories
  excludeStories: /.*Data$/, // 👈 Storybook ignores anything that contains Data
};

export const simpleData = { foo: 1, bar: 'baz' };
export const complexData = { foo: 1, foobar: { bar: 'baz', baz: someData } };

export const SimpleStory = {
  args: {
    data: simpleData,
  },
};

export const ComplexStory = {
  args: {
    data: complexData,
  },
};
```

```js filename="MyComponent.stories.js|jsx" renderer="react" language="js" tabTitle="CSF Factory 🧪"
// Learn about the # subpath import: https://storybook.js.org/docs/api/csf/csf-factories#subpath-imports
import preview from '#.storybook/preview';

import { MyComponent } from './MyComponent';

import someData from './data.json';

const meta = preview.meta({
  component: MyComponent,
  // 👈 Storybook loads these stories
  includeStories: ['SimpleStory', 'ComplexStory'],
  // 👈 Storybook ignores anything that contains Data
  excludeStories: /.*Data$/,
});

export const simpleData = { foo: 1, bar: 'baz' };
export const complexData = { foo: 1, foobar: { bar: 'baz', baz: someData } };

export const SimpleStory = meta.story({
  args: {
    data: simpleData,
  },
});

export const ComplexStory = meta.story({
  args: {
    data: complexData,
  },
});
```

```ts filename="MyComponent.stories.ts|tsx" renderer="react" language="ts-4-9" tabTitle="CSF 3"
import type { Meta, StoryObj } from '@storybook/react';

import { MyComponent } from './MyComponent';

import someData from './data.json';

const meta = {
  component: MyComponent,
  includeStories: ['SimpleStory', 'ComplexStory'], // 👈 Storybook loads these stories
  excludeStories: /.*Data$/, // 👈 Storybook ignores anything that contains Data
} satisfies Meta<typeof MyComponent>;

export default meta;
type Story = StoryObj<typeof meta>;

export const simpleData = { foo: 1, bar: 'baz' };
export const complexData = { foo: 1, foobar: { bar: 'baz', baz: someData } };

export const SimpleStory: Story = {
  args: {
    data: simpleData,
  },
};

export const ComplexStory: Story = {
  args: {
    data: complexData,
  },
};
```

```ts filename="MyComponent.stories.ts|tsx" renderer="react" language="ts-4-9" tabTitle="CSF Factory 🧪"
// Learn about the # subpath import: https://storybook.js.org/docs/api/csf/csf-factories#subpath-imports
import preview from '#.storybook/preview';

import { MyComponent } from './MyComponent';

import someData from './data.json';

const meta = preview.meta({
  component: MyComponent,
  includeStories: ['SimpleStory', 'ComplexStory'], // 👈 Storybook loads these stories
  excludeStories: /.*Data$/, // 👈 Storybook ignores anything that contains Data
});

export const simpleData = { foo: 1, bar: 'baz' };
export const complexData = { foo: 1, foobar: { bar: 'baz', baz: someData } };

export const SimpleStory = meta.story({
  args: {
    data: simpleData,
  },
});

export const ComplexStory = meta.story({
  args: {
    data: complexData,
  },
});
```

```ts filename="MyComponent.stories.ts|tsx" renderer="react" language="ts" tabTitle="CSF 3"
import type { Meta, StoryObj } from '@storybook/react';

import { MyComponent } from './MyComponent';

import someData from './data.json';

const meta: Meta<typeof MyComponent> = {
  component: MyComponent,
  includeStories: ['SimpleStory', 'ComplexStory'], // 👈 Storybook loads these stories
  excludeStories: /.*Data$/, // 👈 Storybook ignores anything that contains Data
};

export default meta;
type Story = StoryObj<typeof MyComponent>;

export const simpleData = { foo: 1, bar: 'baz' };
export const complexData = { foo: 1, foobar: { bar: 'baz', baz: someData } };

export const SimpleStory: Story = {
  args: {
    data: simpleData,
  },
};

export const ComplexStory: Story = {
  args: {
    data: complexData,
  },
};
```

```ts filename="MyComponent.stories.ts|tsx" renderer="react" language="ts" tabTitle="CSF Factory 🧪"
// Learn about the # subpath import: https://storybook.js.org/docs/api/csf/csf-factories#subpath-imports
import preview from '#.storybook/preview';

import { MyComponent } from './MyComponent';

import someData from './data.json';

const meta = preview.meta({
  component: MyComponent,
  includeStories: ['SimpleStory', 'ComplexStory'], // 👈 Storybook loads these stories
  excludeStories: /.*Data$/, // 👈 Storybook ignores anything that contains Data
});

export const simpleData = { foo: 1, bar: 'baz' };
export const complexData = { foo: 1, foobar: { bar: 'baz', baz: someData } };

export const SimpleStory = meta.story({
  args: {
    data: simpleData,
  },
});

export const ComplexStory = meta.story({
  args: {
    data: complexData,
  },
});
```

```js filename="MyComponent.stories.js|jsx" renderer="solid" language="js"
import { MyComponent } from './MyComponent';

import someData from './data.json';

export default {
  component: MyComponent,
  includeStories: ['SimpleStory', 'ComplexStory'], // 👈 Storybook loads these stories
  excludeStories: /.*Data$/, // 👈 Storybook ignores anything that contains Data
};

export const simpleData = { foo: 1, bar: 'baz' };
export const complexData = { foo: 1, foobar: { bar: 'baz', baz: someData } };

export const SimpleStory = {
  args: {
    data: simpleData,
  },
};

export const ComplexStory = {
  args: {
    data: complexData,
  },
};
```

```tsx filename="MyComponent.stories.ts|tsx" renderer="solid" language="ts-4-9"
import type { Meta, StoryObj } from 'storybook-solidjs';

import { MyComponent } from './MyComponent';

import someData from './data.json';

const meta = {
  component: MyComponent,
  includeStories: ['SimpleStory', 'ComplexStory'], // 👈 Storybook loads these stories
  excludeStories: /.*Data$/, // 👈 Storybook ignores anything that contains Data
} satisfies Meta<typeof MyComponent>;

export default meta;
type Story = StoryObj<typeof meta>;

export const simpleData = { foo: 1, bar: 'baz' };
export const complexData = { foo: 1, foobar: { bar: 'baz', baz: someData } };

export const SimpleStory: Story = {
  args: {
    data: simpleData,
  },
};

export const ComplexStory: Story = {
  args: {
    data: complexData,
  },
};
```

```tsx filename="MyComponent.stories.ts|tsx" renderer="solid" language="ts"
import type { Meta, StoryObj } from 'storybook-solidjs';

import { MyComponent } from './MyComponent';

import someData from './data.json';

const meta: Meta<typeof MyComponent> = {
  component: MyComponent,
  includeStories: ['SimpleStory', 'ComplexStory'], // 👈 Storybook loads these stories
  excludeStories: /.*Data$/, // 👈 Storybook ignores anything that contains Data
};

export default meta;
type Story = StoryObj<typeof MyComponent>;

export const simpleData = { foo: 1, bar: 'baz' };
export const complexData = { foo: 1, foobar: { bar: 'baz', baz: someData } };

export const SimpleStory: Story = {
  args: {
    data: simpleData,
  },
};

export const ComplexStory: Story = {
  args: {
    data: complexData,
  },
};
```

```js filename="MyComponent.stories.js" renderer="svelte" language="js"
import MyComponent from './MyComponent.svelte';

import someData from './data.json';

export default {
  component: MyComponent,
  includeStories: ['SimpleStory', 'ComplexStory'], // 👈 Storybook loads these stories
  excludeStories: /.*Data$/, // 👈 Storybook ignores anything that contains Data
};

export const simpleData = { foo: 1, bar: 'baz' };
export const complexData = { foo: 1, foobar: { bar: 'baz', baz: someData } };

export const SimpleStory = {
  args: {
    data: simpleData,
  },
};

export const ComplexStory = {
  args: {
    data: complexData,
  },
};
```

```ts filename="MyComponent.stories.ts" renderer="svelte" language="ts-4-9"
import type { Meta, StoryObj } from '@storybook/svelte';

import MyComponent from './MyComponent.svelte';

import someData from './data.json';

const meta = {
  component: MyComponent,
  includeStories: ['SimpleStory', 'ComplexStory'], // 👈 Storybook loads these stories
  excludeStories: /.*Data$/, // 👈 Storybook ignores anything that contains Data
} satisfies Meta<typeof MyComponent>;

export default meta;
type Story = StoryObj<typeof meta>;

export const simpleData = { foo: 1, bar: 'baz' };
export const complexData = { foo: 1, foobar: { bar: 'baz', baz: someData } };

export const SimpleStory: Story = {
  args: {
    data: simpleData,
  },
};

export const ComplexStory: Story = {
  args: {
    data: complexData,
  },
};
```

```ts filename="MyComponent.stories.ts" renderer="svelte" language="ts"
import type { Meta, StoryObj } from '@storybook/svelte';

import MyComponent from './MyComponent.svelte';

import someData from './data.json';

const meta: Meta<typeof MyComponent> = {
  component: MyComponent,
  includeStories: ['SimpleStory', 'ComplexStory'], // 👈 Storybook loads these stories
  excludeStories: /.*Data$/, // 👈 Storybook ignores anything that contains Data
};

export default meta;
type Story = StoryObj<typeof meta>;

export const simpleData = { foo: 1, bar: 'baz' };
export const complexData = { foo: 1, foobar: { bar: 'baz', baz: someData } };

export const SimpleStory: Story = {
  args: {
    data: simpleData,
  },
};

export const ComplexStory: Story = {
  args: {
    data: complexData,
  },
};
```

```js filename="MyComponent.stories.js" renderer="vue" language="js"
import MyComponent from './MyComponent.vue';

import someData from './data.json';

export default {
  component: MyComponent,
  includeStories: ['SimpleStory', 'ComplexStory'],
  excludeStories: /.*Data$/, // 👈 Storybook ignores anything that contains Data
};

export const simpleData = { foo: 1, bar: 'baz' };
export const complexData = { foo: 1, foobar: { bar: 'baz', baz: someData } };

export const SimpleStory = {
  args: {
    data: simpleData,
  },
};

export const ComplexStory = {
  args: {
    data: complexData,
  },
};
```

```ts filename="MyComponent.stories.ts" renderer="vue" language="ts-4-9"
import type { Meta, StoryObj } from '@storybook/vue3';

import MyComponent from './MyComponent.vue';

import someData from './data.json';

const meta = {
  component: MyComponent,
  includeStories: ['SimpleStory', 'ComplexStory'],
  excludeStories: /.*Data$/, // 👈 Storybook ignores anything that contains Data
} satisfies Meta<typeof MyComponent>;

export const simpleData = { foo: 1, bar: 'baz' };
export const complexData = { foo: 1, foobar: { bar: 'baz', baz: someData } };

export default meta;
type Story = StoryObj<typeof meta>;

export const SimpleStory: Story = {
  args: {
    data: simpleData,
  },
};

export const ComplexStory: Story = {
  args: {
    data: complexData,
  },
};
```

```ts filename="MyComponent.stories.ts" renderer="vue" language="ts"
import type { Meta, StoryObj } from '@storybook/vue3';

import MyComponent from './MyComponent.vue';

import someData from './data.json';

const meta: Meta<typeof MyComponent> = {
  component: MyComponent,
  includeStories: ['SimpleStory', 'ComplexStory'],
  excludeStories: /.*Data$/, // 👈 Storybook ignores anything that contains Data
};

export const simpleData = { foo: 1, bar: 'baz' };
export const complexData = { foo: 1, foobar: { bar: 'baz', baz: someData } };

export default meta;
type Story = StoryObj<typeof MyComponent>;

export const SimpleStory: Story = {
  args: {
    data: simpleData,
  },
};

export const ComplexStory: Story = {
  args: {
    data: complexData,
  },
};
```

```js filename="MyComponent.stories.js" renderer="web-components" language="js"
export default {
  component: 'my-component',
  includeStories: ['SimpleStory', 'ComplexStory'], // 👈 Storybook loads these stories
  excludeStories: /.*Data$/, // 👈 Storybook ignores anything that contains Data
};

export const simpleData = { foo: 1, bar: 'baz' };
export const complexData = { foo: 1, foobar: { bar: 'baz', baz: someData } };

export const SimpleStory = {
  args: {
    data: simpleData,
  },
};

export const ComplexStory = {
  args: {
    data: complexData,
  },
};
```

```ts filename="MyComponent.stories.ts" renderer="web-components" language="ts"
import type { Meta, StoryObj } from '@storybook/web-components';

const meta: Meta = {
  component: 'my-component',
  includeStories: ['SimpleStory', 'ComplexStory'], // 👈 Storybook loads these stories
  excludeStories: /.*Data$/, // 👈 Storybook ignores anything that contains Data
};

export const simpleData = { foo: 1, bar: 'baz' };
export const complexData = { foo: 1, foobar: { bar: 'baz', baz: someData } };

export default meta;
type Story = StoryObj;

export const SimpleStory: Story = {
  args: {
    data: simpleData,
  },
};

export const ComplexStory: Story = {
  args: {
    data: complexData,
  },
};
```
