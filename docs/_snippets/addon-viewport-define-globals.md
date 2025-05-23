```ts filename="Button.stories.ts" renderer="angular" language="ts"
import type { Meta, StoryObj } from '@storybook/angular';

import { Button } from './button.component';

const meta: Meta<Button> = {
  component: Button,
  globals: {
    // 👇 Set viewport for all component stories
    viewport: { value: 'tablet', isRotated: false },
  },
};

export default meta;
type Story = StoryObj<Button>;

export const OnPhone: Story = {
  globals: {
    // 👇 Override viewport for this story
    viewport: { value: 'mobile1', isRotated: false },
  },
};
```

```svelte filename="Button.stories.svelte" renderer="svelte" language="js" tabTitle="Svelte CSF"
<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf';

  import Button from './Button.svelte';

  const { Story } = defineMeta({
    component: Button,
    globals: {
      // 👇 Set viewport for all component stories
      viewport: { value: "tablet", isRotated: false },
    },
  });
</script>

<Story
  name="OnPhone"
  globals={{
    viewport: { value: "mobile1", isRotated: false },
  }}
/>
```

```js filename="Button.stories.js" renderer="svelte" language="js" tabTitle="CSF"
import Button from './Button.svelte';

export default {
  component: Button,
  globals: {
    // 👇 Set viewport for all component stories
    viewport: { value: 'tablet', isRotated: false },
  },
};

export const OnPhone = {
  globals: {
    // 👇 Override viewport for this story
    viewport: { value: 'mobile1', isRotated: false },
  },
};
```

```svelte filename="Button.stories.svelte" renderer="svelte" language="ts" tabTitle="Svelte CSF"
<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf';

  import Button from './Button.svelte';

  const { Story } = defineMeta({
    component: Button,
    globals: {
      // 👇 Set viewport for all component stories
      viewport: { value: "tablet", isRotated: false },
    },
  });
</script>

<Story
  name="OnPhone"
  globals={{
    viewport: { value: "mobile1", isRotated: false },
  }}
/>
```

```ts filename="Button.stories.ts" renderer="svelte" language="ts" tabTitle="CSF"
// Replace your-framework with svelte-vite or sveltekit
import type { Meta, StoryObj } from '@storybook/your-framework';

import { Button } from './Button';

const meta = {
  component: Button,
  globals: {
    // 👇 Set viewport for all component stories
    viewport: { value: 'tablet', isRotated: false },
  },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const OnPhone: Story = {
  globals: {
    // 👇 Override viewport for this story
    viewport: { value: 'mobile1', isRotated: false },
  },
};
```

```js filename="Button.stories.js|jsx" renderer="common" language="js"
import { Button } from './Button';

export default {
  component: Button,
  globals: {
    // 👇 Set viewport for all component stories
    viewport: { value: 'tablet', isRotated: false },
  },
};

export const OnPhone = {
  globals: {
    // 👇 Override viewport for this story
    viewport: { value: 'mobile1', isRotated: false },
  },
};
```

```ts filename="Button.stories.ts|tsx" renderer="common" language="ts"
// Replace your-framework with the framework you are using (e.g., react-vite, vue3-vite, angular, etc.)
import type { Meta, StoryObj } from '@storybook/your-framework';

import { Button } from './Button';

const meta = {
  component: Button,
  globals: {
    // 👇 Set viewport for all component stories
    viewport: { value: 'tablet', isRotated: false },
  },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const OnPhone: Story = {
  globals: {
    // 👇 Override viewport for this story
    viewport: { value: 'mobile1', isRotated: false },
  },
};
```

```js filename="Button.stories.js" renderer="web-components" language="js"
export default {
  component: 'demo-button',
  globals: {
    // 👇 Set viewport for all component stories
    viewport: { value: 'tablet', isRotated: false },
  },
};

export const OnPhone = {
  globals: {
    // 👇 Override viewport for this story
    viewport: { value: 'mobile1', isRotated: false },
  },
};
```

```ts filename="Button.stories.ts" renderer="web-components" language="ts"
import type { Meta, StoryObj } from '@storybook/web-components-vite';

const meta: Meta = {
  component: 'demo-button',
  globals: {
    // 👇 Set viewport for all component stories
    viewport: { value: 'tablet', isRotated: false },
  },
};

export default meta;
type Story = StoryObj;

export const OnPhone: Story = {
  globals: {
    // 👇 Override viewport for this story
    viewport: { value: 'mobile1', isRotated: false },
  },
};
```
