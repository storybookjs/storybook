```ts filename="Button.stories.ts" renderer="angular" language="ts"
import type { Meta, StoryObj } from '@storybook/angular';

import { Button } from './button.component';

const meta: Meta<Button> = {
  component: Button,
};

export default meta;
type Story = StoryObj<Button>;

export const OnDark: Story = {
  // 👇 Story-level parameters
  parameters: {
    backgrounds: {
      default: 'dark',
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
  });
</script>

<!-- 👇 Story-level parameters-->
<Story
  name="OnDark"
  parameters={{
    backgrounds: { default: 'dark' }
  }}
/>
```

```js filename="Button.stories.js" renderer="svelte" language="js" tabTitle="CSF"
import Button from './Button.svelte';

export default {
  component: Button,
};

export const OnDark = {
  // 👇 Story-level parameters
  parameters: {
    backgrounds: {
      default: 'dark',
    },
  },
};
```

```js filename="Button.stories.js|jsx" renderer="common" language="js" tabTitle="CSF 3"
import { Button } from './Button';

export default {
  component: Button,
};

export const OnDark = {
  // 👇 Story-level parameters
  parameters: {
    backgrounds: {
      default: 'dark',
    },
  },
};
```

```js filename="Button.stories.js|jsx" renderer="react" language="js" tabTitle="CSF Factory 🧪"
// Learn about the # subpath import: https://storybook.js.org/docs/api/csf/csf-factories#subpath-imports
import preview from '#.storybook/preview';

import { Button } from './Button';

const meta = preview.meta({
  component: Button,
});

export const OnDark = meta.story({
  // 👇 Story-level parameters
  parameters: {
    backgrounds: {
      default: 'dark',
    },
  },
});
```

```svelte filename="Button.stories.svelte" renderer="svelte" language="ts-4-9" tabTitle="Svelte CSF"
<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf';

  import Button from './Button.svelte';

  const { Story } = defineMeta({
    component: Button,
  });
</script>

<!-- 👇 Story-level parameters-->
<Story
  name="OnDark"
  parameters={{
    backgrounds: { default: 'dark' }
  }}
/>
```

```ts filename="Button.stories.ts" renderer="svelte" language="ts-4-9" tabTitle="CSF"
import type { Meta, StoryObj } from '@storybook/svelte';

import Button from './Button.svelte';

const meta = {
  component: Button,
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const OnDark: Story = {
  // 👇 Story-level parameters
  parameters: {
    backgrounds: {
      default: 'dark',
    },
  },
};
```

```ts filename="Button.stories.ts|tsx" renderer="common" language="ts-4-9" tabTitle="CSF 3"
// Replace your-framework with the framework you are using (e.g., react-webpack5, vue3-vite)
import type { Meta, StoryObj } from '@storybook/your-framework';

import { Button } from './Button';

const meta = {
  component: Button,
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const OnDark: Story = {
  // 👇 Story-level parameters
  parameters: {
    backgrounds: {
      default: 'dark',
    },
  },
};
```

```ts filename="Button.stories.ts|tsx" renderer="react" language="ts-4-9" tabTitle="CSF Factory 🧪"
// Learn about the # subpath import: https://storybook.js.org/docs/api/csf/csf-factories#subpath-imports
import preview from '#.storybook/preview';

import { Button } from './Button';

const meta = preview.meta({
  component: Button,
});

export const OnDark = meta.story({
  // 👇 Story-level parameters
  parameters: {
    backgrounds: {
      default: 'dark',
    },
  },
});
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
  name="OnDark"
  parameters={{
    backgrounds: { default: 'dark' }
  }}
/>
```

```ts filename="Button.stories.ts" renderer="svelte" language="ts" tabTitle="CSF"
import type { Meta, StoryObj } from '@storybook/svelte';

import Button from './Button.svelte';

const meta: Meta<typeof Button> = {
  component: Button,
};

export default meta;
type Story = StoryObj<typeof Button>;

export const OnDark: Story = {
  // 👇 Story-level parameters
  parameters: {
    backgrounds: {
      default: 'dark',
    },
  },
};
```

```ts filename="Button.stories.ts|tsx" renderer="common" language="ts" tabTitle="CSF 3"
// Replace your-framework with the framework you are using (e.g., react-webpack5, vue3-vite)
import type { Meta, StoryObj } from '@storybook/your-framework';

import { Button } from './Button';

const meta: Meta<typeof Button> = {
  component: Button,
};

export default meta;
type Story = StoryObj<typeof Button>;

export const OnDark: Story = {
  // 👇 Story-level parameters
  parameters: {
    backgrounds: {
      default: 'dark',
    },
  },
};
```

```ts filename="Button.stories.ts|tsx" renderer="react" language="ts" tabTitle="CSF Factory 🧪"
// Learn about the # subpath import: https://storybook.js.org/docs/api/csf/csf-factories#subpath-imports
import preview from '#.storybook/preview';

import { Button } from './Button';

const meta = preview.meta({
  component: Button,
});

export const OnDark = meta.story({
  // 👇 Story-level parameters
  parameters: {
    backgrounds: {
      default: 'dark',
    },
  },
});
```

```js filename="Button.stories.js" renderer="web-components" language="js"
export default {
  component: 'demo-button',
};

export const Primary = {
  // 👇 Story-level parameters
  parameters: {
    backgrounds: {
      default: 'dark',
    },
  },
};
```

```ts filename="Button.stories.ts" renderer="web-components" language="ts"
import type { Meta, StoryObj } from '@storybook/web-components';

const meta: Meta = {
  component: 'demo-button',
};

export default meta;
type Story = StoryObj<typeof Button>;

export const Primary: Story = {
  // 👇 Story-level parameters
  parameters: {
    backgrounds: {
      default: 'dark',
    },
  },
};
```
