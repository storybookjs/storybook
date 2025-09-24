```ts filename="Button.stories.ts" renderer="angular" language="ts"
import type { Meta, StoryObj } from '@storybook/angular';

import { Button } from './Button.component';

const meta: Meta<Button> = {
  component: Button,
  parameters: {
    // 👇 Applies to all stories in this file
    a11y: { test: 'error' },
  },
};
export default meta;

type Story = StoryObj<Button>;

// 👇 This story will use the 'error' value and fail on accessibility violations
export const Primary: Story = {
  args: { primary: true },
};

// 👇 This story will not fail on accessibility violations
//    (but will still run the tests and show warnings)
export const NoA11yFail: Story = {
  parameters: {
    a11y: { test: 'todo' },
  },
};
```

```ts filename="Button.stories.ts" renderer="common" language="ts"
// Replace your-framework with the framework you are using, e.g. react-vite, nextjs, vue3-vite, etc.
import type { Meta, StoryObj } from '@storybook/your-framework';

import { Button } from './Button';

const meta = {
  component: Button,
  parameters: {
    // 👇 Applies to all stories in this file
    a11y: { test: 'error' },
  },
} satisfies Meta<typeof Button>;
export default meta;

type Story = StoryObj<typeof meta>;

// 👇 This story will use the 'error' value and fail on accessibility violations
export const Primary: Story = {
  args: { primary: true },
};

// 👇 This story will not fail on accessibility violations
//    (but will still run the tests and show warnings)
export const NoA11yFail: Story = {
  parameters: {
    a11y: { test: 'todo' },
  },
};
```

```js filename="Button.stories.js" renderer="common" language="js"
import { Button } from './Button';

export default {
  component: Button,
  parameters: {
    // 👇 Applies to all stories in this file
    a11y: { test: 'error' },
  },
};

// 👇 This story will use the 'error' value and fail on accessibility violations
export const Primary = {
  args: { primary: true },
};

// 👇 This story will not fail on accessibility violations
//    (but will still run the tests and show warnings)
export const NoA11yFail = {
  parameters: {
    a11y: { test: 'todo' },
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
      // 👇 Applies to all stories in this file
      a11y: { test: 'error' },
    },
  });
</script>

<!-- 👇 This story will use the 'error' value and fail on accessibility violations -->
<Story
  name="Primary"
  args={{ primary: true }}
/>

<!-- 👇 This story will not fail on accessibility violations
        (but will still run the tests and show warnings) -->
<Story
  name="NoA11yFail"
  parameters={{
    a11y: { test: 'todo' },
  }}
/>
```

```ts filename="Button.stories.ts" renderer="svelte" language="ts" tabTitle="CSF"
// Replace your-framework with the framework you are using, e.g. sveltekit or svelte-vite
import type { Meta, StoryObj } from '@storybook/your-framework';

import { Button } from './Button.svelte';

const meta = {
  component: Button,
  parameters: {
    // 👇 Applies to all stories in this file
    a11y: { test: 'error' },
  },
} satisfies Meta<typeof Button>;
export default meta;

type Story = StoryObj<typeof meta>;

// 👇 This story will use the 'error' value and fail on accessibility violations
export const Primary: Story = {
  args: { primary: true },
};

// 👇 This story will not fail on accessibility violations
//    (but will still run the tests and show warnings)
export const NoA11yFail: Story = {
  parameters: {
    a11y: { test: 'todo' },
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
      // 👇 Applies to all stories in this file
      a11y: { test: 'error' },
    },
  });
</script>

<!-- 👇 This story will use the 'error' value and fail on accessibility violations -->
<Story
  name="Primary"
  args={{ primary: true }}
/>

<!-- 👇 This story will not fail on accessibility violations
        (but will still run the tests and show warnings) -->
<Story
  name="NoA11yFail"
  parameters={{
    a11y: { test: 'todo' },
  }}
/>
```

```js filename="Button.stories.js" renderer="svelte" language="js" tabTitle="CSF"
import { Button } from './Button.svelte';

export default {
  component: Button,
  parameters: {
    // 👇 Applies to all stories in this file
    a11y: { test: 'error' },
  },
};

// 👇 This story will use the 'error' value and fail on accessibility violations
export const Primary = {
  args: { primary: true },
};

// 👇 This story will not fail on accessibility violations
//    (but will still run the tests and show warnings)
export const NoA11yFail = {
  parameters: {
    a11y: { test: 'todo' },
  },
};
```

```ts filename="Button.stories.ts" renderer="web-components" language="ts"
import type { Meta, StoryObj } from '@storybook/web-components-vite';

const meta: Meta = {
  component: 'demo-button',
  parameters: {
    // 👇 Applies to all stories in this file
    a11y: { test: 'error' },
  },
};
export default meta;

type Story = StoryObj;

// 👇 This story will use the 'error' value and fail on accessibility violations
export const Primary: Story = {
  args: { primary: true },
};

// 👇 This story will not fail on accessibility violations
//    (but will still run the tests and show warnings)
export const NoA11yFail: Story = {
  parameters: {
    a11y: { test: 'todo' },
  },
};
```

```js filename="Button.stories.js" renderer="web-components" language="js"
export default {
  component: 'demo-button',
  parameters: {
    // 👇 Applies to all stories in this file
    a11y: { test: 'error' },
  },
};

// 👇 This story will use the 'error' value and fail on accessibility violations
export const Primary = {
  args: { primary: true },
};

// 👇 This story will not fail on accessibility violations
//    (but will still run the tests and show warnings)
export const NoA11yFail = {
  parameters: {
    a11y: { test: 'todo' },
  },
};
```
