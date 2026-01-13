```ts filename="Button.stories.ts" renderer="angular" language="ts" tabTitle="CSF 3"
import type { Meta, StoryObj } from '@storybook/angular';

import { Button } from './button.component';

const meta: Meta<Button> = {
  component: Button,
};

export default meta;
type Story = StoryObj<Button>;

export const Primary: Story = {
  // 👇 Story-level parameters
  parameters: {
    backgrounds: {
      options: {
        red: { name: 'Red', value: '#f00' },
        green: { name: 'Green', value: '#0f0' },
        blue: { name: 'Blue', value: '#00f' },
      },
    },
  },
};
```

```ts filename="Button.stories.ts" renderer="angular" language="ts" tabTitle="CSF Next 🧪"
import preview from '../.storybook/preview';

import { Button } from './button.component';

const meta = preview.meta({
  component: Button,
});

export const Primary = meta.story({
  // 👇 Story-level parameters
  parameters: {
    backgrounds: {
      options: {
        red: { name: 'Red', value: '#f00' },
        green: { name: 'Green', value: '#0f0' },
        blue: { name: 'Blue', value: '#00f' },
      },
    },
  },
});
```

```svelte filename="Button.stories.svelte" renderer="svelte" language="js" tabTitle="Svelte CSF"
<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf';

  import Button from './Button.svelte';

  const { Story } = defineMeta({
    component: Button,
  });
</script>

<!-- 👇 Story-level parameters-->
<Story
  name="Primary"
  parameters={{
    backgrounds: {
      options: {
        red: { name: 'Red', value: '#f00' },
        green: { name: 'Green', value: '#0f0' },
        blue: { name: 'Blue', value: '#00f' },
      },
    },
  }}
/>
```

```js filename="Button.stories.js" renderer="svelte" language="js" tabTitle="CSF"
import Button from './Button.svelte';

export default {
  component: Button,
};

export const Primary = {
  // 👇 Story-level parameters
  parameters: {
    backgrounds: {
      options: {
        red: { name: 'Red', value: '#f00' },
        green: { name: 'Green', value: '#0f0' },
        blue: { name: 'Blue', value: '#00f' },
      },
    },
  },
};
```

```js filename="Button.stories.js|jsx" renderer="common" language="js" tabTitle="CSF 3"
import { Button } from './Button';

export default {
  component: Button,
};

export const Primary = {
  // 👇 Story-level parameters
  parameters: {
    backgrounds: {
      options: {
        red: { name: 'Red', value: '#f00' },
        green: { name: 'Green', value: '#0f0' },
        blue: { name: 'Blue', value: '#00f' },
      },
    },
  },
};
```

```svelte filename="Button.stories.svelte" renderer="svelte" language="ts" tabTitle="Svelte CSF"
<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf';

  import Button from './Button.svelte';

  const { Story } = defineMeta({
    component: Button,
  });
</script>

<!-- 👇 Story-level parameters-->
<Story
  name="Primary"
  parameters={{
    backgrounds: {
      options: {
        red: { name: 'Red', value: '#f00' },
        green: { name: 'Green', value: '#0f0' },
        blue: { name: 'Blue', value: '#00f' },
      },
    },
  }}
/>
```

```ts filename="Button.stories.ts" renderer="svelte" language="ts" tabTitle="CSF"
// Replace your-framework with svelte-vite or sveltekit
import type { Meta, StoryObj } from '@storybook/your-framework';

import Button from './Button.svelte';

const meta = {
  component: Button,
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Primary: Story = {
  // 👇 Story-level parameters
  parameters: {
    backgrounds: {
      options: {
        red: { name: 'Red', value: '#f00' },
        green: { name: 'Green', value: '#0f0' },
        blue: { name: 'Blue', value: '#00f' },
      },
    },
  },
};
```

```ts filename="Button.stories.ts|tsx" renderer="common" language="ts" tabTitle="CSF 3"
// Replace your-framework with the framework you are using, e.g. react-vite, nextjs, vue3-vite, etc.
import type { Meta, StoryObj } from '@storybook/your-framework';

import { Button } from './Button';

const meta = {
  component: Button,
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Primary: Story = {
  // 👇 Story-level parameters
  parameters: {
    backgrounds: {
      options: {
        red: { name: 'Red', value: '#f00' },
        green: { name: 'Green', value: '#0f0' },
        blue: { name: 'Blue', value: '#00f' },
      },
    },
  },
};
```

```js filename="Button.stories.js" renderer="web-components" language="js" tabTitle="CSF 3"
export default {
  component: 'demo-button',
};

export const Primary = {
  // 👇 Story-level parameters
  parameters: {
    backgrounds: {
      options: {
        red: { name: 'Red', value: '#f00' },
        green: { name: 'Green', value: '#0f0' },
        blue: { name: 'Blue', value: '#00f' },
      },
    },
  },
};
```

```ts filename="Button.stories.ts" renderer="web-components" language="ts" tabTitle="CSF 3"
import type { Meta, StoryObj } from '@storybook/web-components-vite';

const meta: Meta = {
  component: 'demo-button',
};

export default meta;
type Story = StoryObj;

export const Primary = {
  // 👇 Story-level parameters
  parameters: {
    backgrounds: {
      options: {
        red: { name: 'Red', value: '#f00' },
        green: { name: 'Green', value: '#0f0' },
        blue: { name: 'Blue', value: '#00f' },
      },
    },
  },
};
```

```js filename="Button.stories.js" renderer="web-components" language="js" tabTitle="CSF Next 🧪"
import preview from '../.storybook/preview';

const meta = preview.meta({
  component: 'demo-button',
});

export const Primary = meta.story({
  // 👇 Story-level parameters
  parameters: {
    backgrounds: {
      options: {
        red: { name: 'Red', value: '#f00' },
        green: { name: 'Green', value: '#0f0' },
        blue: { name: 'Blue', value: '#00f' },
      },
    },
  },
});
```

```ts filename="Button.stories.ts" renderer="web-components" language="ts" tabTitle="CSF Next 🧪"
import preview from '../.storybook/preview';

const meta = preview.meta({
  component: 'demo-button',
});

export const Primary = meta.story({
  // 👇 Story-level parameters
  parameters: {
    backgrounds: {
      options: {
        red: { name: 'Red', value: '#f00' },
        green: { name: 'Green', value: '#0f0' },
        blue: { name: 'Blue', value: '#00f' },
      },
    },
  },
});
```

```ts filename="Button.stories.ts|tsx" renderer="react" language="ts" tabTitle="CSF Next 🧪"
import preview from '../.storybook/preview';

import { Button } from './Button';

const meta = preview.meta({
  component: Button,
});

export const Primary = meta.story({
  // 👇 Story-level parameters
  parameters: {
    backgrounds: {
      options: {
        red: { name: 'Red', value: '#f00' },
        green: { name: 'Green', value: '#0f0' },
        blue: { name: 'Blue', value: '#00f' },
      },
    },
  },
});
```

<!-- JS snippets still needed while providing both CSF 3 & Next -->

```js filename="Button.stories.js|jsx" renderer="react" language="js" tabTitle="CSF Next 🧪"
import preview from '../.storybook/preview';

import { Button } from './Button';

const meta = preview.meta({
  component: Button,
});

export const Primary = meta.story({
  // 👇 Story-level parameters
  parameters: {
    backgrounds: {
      options: {
        red: { name: 'Red', value: '#f00' },
        green: { name: 'Green', value: '#0f0' },
        blue: { name: 'Blue', value: '#00f' },
      },
    },
  },
});
```

```ts filename="Button.stories.ts" renderer="vue" language="ts" tabTitle="CSF Next 🧪"
import preview from '../.storybook/preview';

import Button from './Button.vue';

const meta = preview.meta({
  component: Button,
});

export const Primary = meta.story({
  // 👇 Story-level parameters
  parameters: {
    backgrounds: {
      options: {
        red: { name: 'Red', value: '#f00' },
        green: { name: 'Green', value: '#0f0' },
        blue: { name: 'Blue', value: '#00f' },
      },
    },
  },
});
```

<!-- JS snippets still needed while providing both CSF 3 & Next -->

```js filename="Button.stories.js" renderer="vue" language="js" tabTitle="CSF Next 🧪"
import preview from '../.storybook/preview';

import Button from './Button.vue';

const meta = preview.meta({
  component: Button,
});

export const Primary = meta.story({
  // 👇 Story-level parameters
  parameters: {
    backgrounds: {
      options: {
        red: { name: 'Red', value: '#f00' },
        green: { name: 'Green', value: '#0f0' },
        blue: { name: 'Blue', value: '#00f' },
      },
    },
  },
});
```
