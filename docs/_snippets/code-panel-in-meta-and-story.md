```ts filename="Button.stories.ts" renderer="angular" language="ts"
import type { Meta, StoryObj } from '@storybook/angular';

import { Button } from './Button.component';

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
const Primary: Story = {
  args: {
    children: 'Button',
  },
};

const Secondary: Story = {
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

```ts filename="Button.stories.ts|tsx" renderer="react" language="ts"
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
const Primary: Story = {
  args: {
    children: 'Button',
  },
};

const Secondary: Story = {
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

```js filename="Button.stories.js|jsx" renderer="react" language="js"
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
const Primary = {
  args: {
    children: 'Button',
  },
};

const Secondary = {
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

```ts filename="Button.stories.ts" renderer="svelte" language="ts" tabTitle="CSF"
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
const Primary: Story = {
  args: {
    children: 'Button',
  },
};

const Secondary: Story = {
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

```js filename="Button.stories.js" renderer="svelte" language="js" tabTitle="CSF"
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
const Primary = {
  args: {
    children: 'Button',
  },
};

const Secondary = {
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

```ts filename="Button.stories.ts" renderer="vue" language="ts"
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
const Primary: Story = {
  args: {
    children: 'Button',
  },
};

const Secondary: Story = {
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

```js filename="Button.stories.js" renderer="vue" language="js"
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
const Primary = {
  args: {
    children: 'Button',
  },
};

const Secondary = {
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

```ts filename="Button.stories.ts" renderer="web-components" language="ts"
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
const Primary: Story = {
  args: {
    children: 'Button',
  },
};

const Secondary: Story = {
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

```js filename="Button.stories.js" renderer="web-components" language="js"
export default {
  component: 'my-component',
  parameters: {
    docs: {
      // 👇 Enable Code panel for all stories in this file
      codePanel: true,
    },
  },
};

// 👇 This story will display the Code panel
const Primary = {
  args: {
    children: 'Button',
  },
};

const Secondary = {
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
