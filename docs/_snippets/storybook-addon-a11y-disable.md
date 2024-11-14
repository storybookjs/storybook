```ts filename="MyComponent.stories.ts" renderer="angular" language="ts"
import type { Meta, StoryObj } from '@storybook/angular';

import { MyComponent } from './MyComponent.component';

const meta: Meta<MyComponent> = {
  component: MyComponent,
};

export default meta;
type Story = StoryObj<MyComponent>;

export const NonA11yStory: Story = {
  parameters: {
    a11y: {
      // This option disables all a11y checks on this story
      disabled: true,
    },
  },
};
```

```js filename="MyComponent.stories.js|jsx" renderer="react" language="js"
import { MyComponent } from './MyComponent';

export default {
  component: MyComponent,
};

export const NonA11yStory = {
  parameters: {
    a11y: {
      // This option disables all a11y checks on this story
      disable: true,
    },
  },
};
```

```ts filename="MyComponent.stories.ts|tsx" renderer="react" language="ts-4-9"
import type { Meta, StoryObj } from '@storybook/react';

import { MyComponent } from './MyComponent';

const meta = {
  component: MyComponent,
} satisfies Meta<typeof MyComponent>;

export default meta;
type Story = StoryObj<typeof meta>;

export const NonA11yStory: Story = {
  parameters: {
    a11y: {
      // This option disables all a11y checks on this story
      disable: true,
    },
  },
};
```

```ts filename="MyComponent.stories.ts|tsx" renderer="react" language="ts"
import type { Meta, StoryObj } from '@storybook/react';

import { MyComponent } from './MyComponent';

const meta: Meta<typeof MyComponent> = {
  component: MyComponent,
};

export default meta;
type Story = StoryObj<typeof MyComponent>;

export const NonA11yStory: Story = {
  parameters: {
    a11y: {
      // This option disables all a11y checks on this story
      disable: true,
    },
  },
};
```

```js filename="MyComponent.stories.js" renderer="svelte" language="js"
import MyComponent from './MyComponent.svelte';

export default {
  component: MyComponent,
};

export const NonA11yStory = {
  parameters: {
    a11y: {
      // This option disables all a11y checks on this story
      disable: true,
    },
  },
};
```

```ts filename="MyComponent.stories.ts" renderer="svelte" language="ts-4-9"
import type { Meta, StoryObj } from '@storybook/svelte';

import MyComponent from './MyComponent.svelte';

const meta = {
  component: MyComponent,
} satisfies Meta<typeof MyComponent>;

export default meta;
type Story = StoryObj<typeof meta>;

export const NonA11yStory: Story = {
  parameters: {
    a11y: {
      // This option disables all a11y checks on this story
      disable: true,
    },
  },
};
```

```ts filename="MyComponent.stories.ts" renderer="svelte" language="ts"
import type { Meta, StoryObj } from '@storybook/svelte';

import MyComponent from './MyComponent.svelte';

const meta: Meta<typeof MyComponent> = {
  component: MyComponent,
};

export default meta;
type Story = StoryObj<typeof meta>;

export const NonA11yStory: Story = {
  parameters: {
    a11y: {
      // This option disables all a11y checks on this story
      disable: true,
    },
  },
};
```

```js filename="MyComponent.stories.js" renderer="vue" language="js"
import MyComponent from './MyComponent.vue';

export default {
  component: MyComponent,
};

export const NonA11yStory = {
  render: () => ({
    components: { MyComponent },
    template: '<MyComponent/>',
  }),
  parameters: {
    a11y: {
      // This option disables all a11y checks on this story
      disable: true,
    },
  },
};
```

```ts filename="MyComponent.stories.ts" renderer="vue" language="ts-4-9"
// Replace vue3 with vue if you are using Storybook for Vue 2
import type { Meta, StoryObj } from '@storybook/vue3';

import MyComponent from './MyComponent.vue';

const meta = {
  component: MyComponent,
} satisfies Meta<typeof MyComponent>;

export default meta;
type Story = StoryObj<typeof meta>;

export const NonA11yStory: Story = {
  render: () => ({
    components: { MyComponent },
    template: '<MyComponent/>',
  }),
  parameters: {
    a11y: {
      // This option disables all a11y checks on this story
      disable: true,
    },
  },
};
```

```ts filename="MyComponent.stories.ts" renderer="vue" language="ts"
// Replace vue3 with vue if you are using Storybook for Vue 2
import type { Meta, StoryObj } from '@storybook/vue3';

import MyComponent from './MyComponent.vue';

const meta: Meta<typeof MyComponent> = {
  component: MyComponent,
};

export default meta;
type Story = StoryObj<typeof MyComponent>;

export const NonA11yStory: Story = {
  render: () => ({
    components: { MyComponent },
    template: '<MyComponent/>',
  }),
  parameters: {
    a11y: {
      // This option disables all a11y checks on this story
      disable: true,
    },
  },
};
```

```js filename="MyComponent.stories.js" renderer="web-components" language="js"
export default {
  component: 'my-component',
};

export const ExampleStory = {
  parameters: {
    a11y: {
      // This option disables all a11y checks on this story
      disable: true,
    },
  },
};
```

```ts filename="MyComponent.stories.ts" renderer="web-components" language="ts"
import type { Meta, StoryObj } from '@storybook/web-components';

const meta: Meta = {
  component: 'my-component',
};

export default meta;
type Story = StoryObj;

export const ExampleStory: Story = {
  parameters: {
    a11y: {
      // This option disables all a11y checks on this story
      disable: true,
    },
  },
};
```
