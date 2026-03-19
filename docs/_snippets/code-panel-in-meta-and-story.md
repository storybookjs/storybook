```ts filename="Button.stories.ts" renderer="angular" language="ts" tabTitle="CSF 3"
import type { Meta, StoryObj } from '@storybook/angular';

import { Button } from './button.component';

const meta: Meta<Button> = {
  component: Button,
  parameters: {
    docs: {
      // 👇 Enable Code panel for all stories in this file
      codePanel: true,
    },
  },
};
export default meta;

type Story = StoryObj<typeof Button>;

// 👇 This story will display the Code panel
export const Primary: Story = {
  args: {
    children: 'Button',
  },
};

export const Secondary: Story = {
  args: {
    children: 'Button',
    variant: 'secondary',
  },
  parameters: {
    docs: {
      // 👇 Disable Code panel for this specific story
      codePanel: false,
    },
  },
};
```

```ts filename="Button.stories.ts" renderer="angular" language="ts" tabTitle="CSF Next 🧪"
import preview from '../.storybook/preview';

import { Button } from './button.component';

const meta = preview.meta({
  component: Button,
  parameters: {
    docs: {
      // 👇 Enable Code panel for all stories in this file
      codePanel: true,
    },
  },
});

// 👇 This story will display the Code panel
export const Primary = meta.story({
  args: {
    children: 'Button',
  },
});

export const Secondary = meta.story({
  args: {
    children: 'Button',
    variant: 'secondary',
  },
  parameters: {
    docs: {
      // 👇 Disable Code panel for this specific story
      codePanel: false,
    },
  },
});
```

```ts filename="Button.stories.ts|tsx" renderer="react" language="ts" tabTitle="CSF 3"
import type { Meta, StoryObj } from '@storybook/react-vite';

import { Button } from './Button';

const meta = {
  component: Button,
  parameters: {
    docs: {
      // 👇 Enable Code panel for all stories in this file
      codePanel: true,
    },
  },
} satisfies Meta<typeof Button>;
export default meta;

type Story = StoryObj<typeof meta>;

// 👇 This story will display the Code panel
export const Primary: Story = {
  args: {
    children: 'Button',
  },
};

export const Secondary: Story = {
  args: {
    children: 'Button',
    variant: 'secondary',
  },
  parameters: {
    docs: {
      // 👇 Disable Code panel for this specific story
      codePanel: false,
    },
  },
};
```

```js filename="Button.stories.js|jsx" renderer="react" language="js" tabTitle="CSF 3"
import { Button } from './Button';

export default {
  component: Button,
  parameters: {
    docs: {
      // 👇 Enable Code panel for all stories in this file
      codePanel: true,
    },
  },
};

// 👇 This story will display the Code panel
export const Primary = {
  args: {
    children: 'Button',
  },
};

export const Secondary = {
  args: {
    children: 'Button',
    variant: 'secondary',
  },
  parameters: {
    docs: {
      // 👇 Disable Code panel for this specific story
      codePanel: false,
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
    parameters: {
      docs: {
        // 👇 Enable Code panel for all stories in this file
        codePanel: true,
      },
    },
  });
</script>

<Story
  name="Primary"
  args={{
    children: 'Button',
  }}
/>

<Story
  name="Secondary"
  args={{
    children: 'Button',
    variant: 'secondary',
  }}
  parameters={{
    docs: {
      // 👇 Disable Code panel for this specific story
      codePanel: false,
    },
  }}
/>
```

```ts filename="Button.stories.ts" renderer="svelte" language="ts" tabTitle="CSF 3"
// Replace your-framework with svelte-vite or sveltekit
import type { Meta, StoryObj } from '@storybook/your-framework';

import Button from './Button.svelte';

const meta = {
  component: Button,
  parameters: {
    docs: {
      // 👇 Enable Code panel for all stories in this file
      codePanel: true,
    },
  },
} satisfies Meta<typeof Button>;
export default meta;

type Story = StoryObj<typeof meta>;

// 👇 This story will display the Code panel
export const Primary: Story = {
  args: {
    children: 'Button',
  },
};

export const Secondary: Story = {
  args: {
    children: 'Button',
    variant: 'secondary',
  },
  parameters: {
    docs: {
      // 👇 Disable Code panel for this specific story
      codePanel: false,
    },
  },
};
```

```svelte filename="Button.stories.svelte" renderer="svelte" language="js" tabTitle="Svelte CSF"
<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf';

  import Button from './Button.svelte';

  const { Story } = defineMeta({
    component: Button,
    parameters: {
      docs: {
        // 👇 Enable Code panel for all stories in this file
        codePanel: true,
      },
    },
  });
</script>

<Story
  name="Primary"
  args={{
    children: 'Button',
  }}
/>

<Story
  name="Secondary"
  args={{
    children: 'Button',
    variant: 'secondary',
  }}
  parameters={{
    docs: {
      // 👇 Disable Code panel for this specific story
      codePanel: false,
    },
  }}
/>
```

```js filename="Button.stories.js" renderer="svelte" language="js" tabTitle="CSF 3"
import Button from './Button.svelte';

export default {
  component: Button,
  parameters: {
    docs: {
      // 👇 Enable Code panel for all stories in this file
      codePanel: true,
    },
  },
};

// 👇 This story will display the Code panel
export const Primary = {
  args: {
    children: 'Button',
  },
};

export const Secondary = {
  args: {
    children: 'Button',
    variant: 'secondary',
  },
  parameters: {
    docs: {
      // 👇 Disable Code panel for this specific story
      codePanel: false,
    },
  },
};
```

```ts filename="Button.stories.ts" renderer="vue" language="ts" tabTitle="CSF 3"
import type { Meta, StoryObj } from '@storybook/vue3-vite';

import Button from './Button.vue';

const meta = {
  component: Button,
  parameters: {
    docs: {
      // 👇 Enable Code panel for all stories in this file
      codePanel: true,
    },
  },
} satisfies Meta<typeof Button>;
export default meta;

type Story = StoryObj<typeof meta>;

// 👇 This story will display the Code panel
export const Primary: Story = {
  args: {
    children: 'Button',
  },
};

export const Secondary: Story = {
  args: {
    children: 'Button',
    variant: 'secondary',
  },
  parameters: {
    docs: {
      // 👇 Disable Code panel for this specific story
      codePanel: false,
    },
  },
};
```

```js filename="Button.stories.js" renderer="vue" language="js" tabTitle="CSF 3"
import Button from './Button.vue';

export default {
  component: Button,
  parameters: {
    docs: {
      // 👇 Enable Code panel for all stories in this file
      codePanel: true,
    },
  },
};

// 👇 This story will display the Code panel
export const Primary = {
  args: {
    children: 'Button',
  },
};

export const Secondary = {
  args: {
    children: 'Button',
    variant: 'secondary',
  },
  parameters: {
    docs: {
      // 👇 Disable Code panel for this specific story
      codePanel: false,
    },
  },
};
```

```ts filename="Button.stories.ts" renderer="vue" language="ts" tabTitle="CSF Next 🧪"
import preview from '../.storybook/preview';

import Button from './Button.vue';

const meta = preview.meta({
  component: Button,
  parameters: {
    docs: {
      // 👇 Enable Code panel for all stories in this file
      codePanel: true,
    },
  },
});

// 👇 This story will display the Code panel
export const Primary = meta.story({
  args: {
    children: 'Button',
  },
});

export const Secondary = meta.story({
  args: {
    children: 'Button',
    variant: 'secondary',
  },
  parameters: {
    docs: {
      // 👇 Disable Code panel for this specific story
      codePanel: false,
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
  parameters: {
    docs: {
      // 👇 Enable Code panel for all stories in this file
      codePanel: true,
    },
  },
});

// 👇 This story will display the Code panel
export const Primary = meta.story({
  args: {
    children: 'Button',
  },
});

export const Secondary = meta.story({
  args: {
    children: 'Button',
    variant: 'secondary',
  },
  parameters: {
    docs: {
      // 👇 Disable Code panel for this specific story
      codePanel: false,
    },
  },
});
```

```ts filename="Button.stories.ts" renderer="web-components" language="ts" tabTitle="CSF 3"
import type { Meta, StoryObj } from '@storybook/web-components-vite';

const meta: Meta = {
  component: 'demo-button',
  parameters: {
    docs: {
      // 👇 Enable Code panel for all stories in this file
      codePanel: true,
    },
  },
};
export default meta;

type Story = StoryObj;

// 👇 This story will display the Code panel
export const Primary: Story = {
  args: {
    children: 'Button',
  },
};

export const Secondary: Story = {
  args: {
    children: 'Button',
    variant: 'secondary',
  },
  parameters: {
    docs: {
      // 👇 Disable Code panel for this specific story
      codePanel: false,
    },
  },
};
```

```js filename="Button.stories.js" renderer="web-components" language="js" tabTitle="CSF 3"
export default {
  component: 'demo-button',
  parameters: {
    docs: {
      // 👇 Enable Code panel for all stories in this file
      codePanel: true,
    },
  },
};

// 👇 This story will display the Code panel
export const Primary = {
  args: {
    children: 'Button',
  },
};

export const Secondary = {
  args: {
    children: 'Button',
    variant: 'secondary',
  },
  parameters: {
    docs: {
      // 👇 Disable Code panel for this specific story
      codePanel: false,
    },
  },
};
```

```js filename="Button.stories.js" renderer="web-components" language="js" tabTitle="CSF Next 🧪"
import preview from '../.storybook/preview';

const meta = preview.meta({
  component: 'demo-button',
  parameters: {
    docs: {
      // 👇 Enable Code panel for all stories in this file
      codePanel: true,
    },
  },
});

// 👇 This story will display the Code panel
export const Primary = meta.story({
  args: {
    children: 'Button',
  },
});

export const Secondary = meta.story({
  args: {
    children: 'Button',
    variant: 'secondary',
  },
  parameters: {
    docs: {
      // 👇 Disable Code panel for this specific story
      codePanel: false,
    },
  },
});
```

```ts filename="Button.stories.ts" renderer="web-components" language="ts" tabTitle="CSF Next 🧪"
import preview from '../.storybook/preview';

const meta = preview.meta({
  component: 'demo-button',
  parameters: {
    docs: {
      // 👇 Enable Code panel for all stories in this file
      codePanel: true,
    },
  },
});

// 👇 This story will display the Code panel
export const Primary = meta.story({
  args: {
    children: 'Button',
  },
});

export const Secondary = meta.story({
  args: {
    children: 'Button',
    variant: 'secondary',
  },
  parameters: {
    docs: {
      // 👇 Disable Code panel for this specific story
      codePanel: false,
    },
  },
});
```

```ts filename="Button.stories.ts|tsx" renderer="react" language="ts" tabTitle="CSF Next 🧪"
import preview from '../.storybook/preview';

import { Button } from './Button';

const meta = preview.meta({
  component: Button,
  parameters: {
    docs: {
      // 👇 Enable Code panel for all stories in this file
      codePanel: true,
    },
  },
});

// 👇 This story will display the Code panel
export const Primary = meta.story({
  args: {
    children: 'Button',
  },
});

export const Secondary = meta.story({
  args: {
    children: 'Button',
    variant: 'secondary',
  },
  parameters: {
    docs: {
      // 👇 Disable Code panel for this specific story
      codePanel: false,
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
  parameters: {
    docs: {
      // 👇 Enable Code panel for all stories in this file
      codePanel: true,
    },
  },
});

// 👇 This story will display the Code panel
export const Primary = meta.story({
  args: {
    children: 'Button',
  },
});

export const Secondary = meta.story({
  args: {
    children: 'Button',
    variant: 'secondary',
  },
  parameters: {
    docs: {
      // 👇 Disable Code panel for this specific story
      codePanel: false,
    },
  },
});
```
