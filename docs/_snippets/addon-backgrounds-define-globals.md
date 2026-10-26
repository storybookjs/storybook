```ts filename="Button.stories.ts" renderer="angular" language="ts" tabTitle="CSF 4"
import preview from '../.storybook/preview';

import { Button } from './button.component';

const meta = preview.meta({
  component: Button,
  globals: {
    // 👇 Set background value for all component stories
    backgrounds: { value: 'gray', grid: false },
  },
});

export const OnDark = meta.story({
  globals: {
    // 👇 Override background value for this story
    backgrounds: { value: 'dark' },
  },
});
```

```ts filename="Button.stories.ts" renderer="web-components" language="ts" tabTitle="CSF 4"
import preview from '../.storybook/preview';

const meta = preview.meta({
  component: 'demo-button',
  globals: {
    // 👇 Set background value for all component stories
    backgrounds: { value: 'gray', grid: false },
  },
});

export const OnDark = meta.story({
  globals: {
    // 👇 Override background value for this story
    backgrounds: { value: 'dark' },
  },
});
```

```svelte filename="Button.stories.svelte" renderer="svelte" language="js" tabTitle="CSF 4"
<script module>
  import preview from '../.storybook/preview';

  import Button from './Button.svelte';

  const { Story } = preview.meta({
    component: Button,
    globals: {
      // 👇 Set background value for all component stories
      backgrounds: { value: 'gray', grid: false },
    },
  });
</script>

<!-- 👇 Override background value for this story -->
<Story
  name="OnDark"
  globals={{
    backgrounds: { value: "dark" },
  }}
/>
```

```svelte filename="Button.stories.svelte" renderer="svelte" language="js" tabTitle="CSF 3"
<!-- ⚠️ CSF 3 is deprecated and will be removed in Storybook 12 -->
<script module>
  // Replace your-framework with the framework you are using, e.g. sveltekit or svelte-vite
  import { defineMeta } from '@storybook/your-framework';

  import Button from './Button.svelte';

  const { Story } = defineMeta({
    component: Button,
    globals: {
      // 👇 Set background value for all component stories
      backgrounds: { value: 'gray', grid: false },
    },
  });
</script>

<!-- 👇 Override background value for this story -->
<Story
  name="OnDark"
  globals={{
    backgrounds: { value: "dark" },
  }}
/>
```

```svelte filename="Button.stories.svelte" renderer="svelte" language="ts" tabTitle="CSF 4"
<script module lang="ts">
  import preview from '../.storybook/preview';

  import Button from './Button.svelte';

  const { Story } = preview.meta({
    component: Button,
    globals: {
      // 👇 Set background value for all component stories
      backgrounds: { value: 'gray', grid: false },
    },
  });
</script>

<!-- 👇 Override background value for this story-->
<Story
  name="OnDark"
  globals={{
    backgrounds: { value: "dark" },
  }}
/>
```

```svelte filename="Button.stories.svelte" renderer="svelte" language="ts" tabTitle="CSF 3"
<!-- ⚠️ CSF 3 is deprecated and will be removed in Storybook 12 -->
<script module>
  // Replace your-framework with the framework you are using, e.g. sveltekit or svelte-vite
  import { defineMeta } from '@storybook/your-framework';

  import Button from './Button.svelte';

  const { Story } = defineMeta({
    component: Button,
    globals: {
      // 👇 Set background value for all component stories
      backgrounds: { value: 'gray', grid: false },
    },
  });
</script>

<!-- 👇 Override background value for this story-->
<Story
  name="OnDark"
  globals={{
    backgrounds: { value: "dark" },
  }}
/>
```

```js filename="Button.stories.js" renderer="web-components" language="js" tabTitle="CSF 4"
import preview from '../.storybook/preview';

const meta = preview.meta({
  component: 'demo-button',
  globals: {
    // 👇 Set background value for all component stories
    backgrounds: { value: 'gray', grid: false },
  },
});

export const OnDark = meta.story({
  globals: {
    // 👇 Override background value for this story
    backgrounds: { value: 'dark' },
  },
});
```

```ts filename="Button.stories.ts|tsx" renderer="react" language="ts" tabTitle="CSF 4"
import preview from '../.storybook/preview';

import { Button } from './Button';

const meta = preview.meta({
  component: Button,
  globals: {
    // 👇 Set background value for all component stories
    backgrounds: { value: 'gray', grid: false },
  },
});

export const OnDark = meta.story({
  globals: {
    // 👇 Override background value for this story
    backgrounds: { value: 'dark' },
  },
});
```

```js filename="Button.stories.js|jsx" renderer="react" language="js" tabTitle="CSF 4"
import preview from '../.storybook/preview';

import { Button } from './Button';

const meta = preview.meta({
  component: Button,
  globals: {
    // 👇 Set background value for all component stories
    backgrounds: { value: 'gray', grid: false },
  },
});

export const OnDark = meta.story({
  globals: {
    // 👇 Override background value for this story
    backgrounds: { value: 'dark' },
  },
});
```

```ts filename="Button.stories.ts" renderer="vue" language="ts" tabTitle="CSF 4"
import preview from '../.storybook/preview';

import Button from './Button.vue';

const meta = preview.meta({
  component: Button,
  globals: {
    // 👇 Set background value for all component stories
    backgrounds: { value: 'gray', grid: false },
  },
});

export const OnDark = meta.story({
  globals: {
    // 👇 Override background value for this story
    backgrounds: { value: 'dark' },
  },
});
```

```js filename="Button.stories.js" renderer="vue" language="js" tabTitle="CSF 4"
import preview from '../.storybook/preview';

import Button from './Button.vue';

const meta = preview.meta({
  component: Button,
  globals: {
    // 👇 Set background value for all component stories
    backgrounds: { value: 'gray', grid: false },
  },
});

export const OnDark = meta.story({
  globals: {
    // 👇 Override background value for this story
    backgrounds: { value: 'dark' },
  },
});
```

```ts filename="Button.stories.ts" renderer="angular" language="ts" tabTitle="CSF 3"
// ⚠️ CSF versions 1, 2, and 3 will be removed in a future version of Storybook. Upgrade to CSF 4: https://storybook.js.org/docs/writing-stories/csf#upgrade-to-csf-4
import type { Meta, StoryObj } from '@storybook/angular';

import { Button } from './button.component';

const meta: Meta<Button> = {
  component: Button,
  globals: {
    // 👇 Set background value for all component stories
    backgrounds: { value: 'gray', grid: false },
  },
};

export default meta;
type Story = StoryObj<Button>;

export const OnDark: Story = {
  globals: {
    // 👇 Override background value for this story
    backgrounds: { value: 'dark' },
  },
};
```

```ts filename="Button.stories.ts|tsx" renderer="common" language="ts" tabTitle="CSF 3"
// ⚠️ CSF versions 1, 2, and 3 will be removed in a future version of Storybook. Upgrade to CSF 4: https://storybook.js.org/docs/writing-stories/csf#upgrade-to-csf-4
// Replace your-framework with the name of your framework (e.g., react-vite, vue3-vite, etc.)
import type { Meta, StoryObj } from '@storybook/your-framework';

import { Button } from './Button';

const meta = {
  component: Button,
  globals: {
    // 👇 Set background value for all component stories
    backgrounds: { value: 'gray', grid: false },
  },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const OnDark: Story = {
  globals: {
    // 👇 Override background value for this story
    backgrounds: { value: 'dark' },
  },
};
```

```js filename="Button.stories.js|jsx" renderer="common" language="js" tabTitle="CSF 3"
// ⚠️ CSF versions 1, 2, and 3 will be removed in a future version of Storybook. Upgrade to CSF 4: https://storybook.js.org/docs/writing-stories/csf#upgrade-to-csf-4
import { Button } from './Button';

export default {
  component: Button,
  globals: {
    // 👇 Set background value for all component stories
    backgrounds: { value: 'gray', grid: false },
  },
};

export const OnDark = {
  globals: {
    // 👇 Override background value for this story
    backgrounds: { value: 'dark' },
  },
};
```

```ts filename="Button.stories.ts" renderer="web-components" language="ts" tabTitle="CSF 3"
// ⚠️ CSF versions 1, 2, and 3 will be removed in a future version of Storybook. Upgrade to CSF 4: https://storybook.js.org/docs/writing-stories/csf#upgrade-to-csf-4
import type { Meta, StoryObj } from '@storybook/web-components-vite';

const meta: Meta = {
  component: 'demo-button',
  globals: {
    // 👇 Set background value for all component stories
    backgrounds: { value: 'gray', grid: false },
  },
};

export default meta;
type Story = StoryObj;

export const OnDark: Story = {
  globals: {
    // 👇 Override background value for this story
    backgrounds: { value: 'dark' },
  },
};
```

```js filename="Button.stories.js" renderer="web-components" language="js" tabTitle="CSF 3"
// ⚠️ CSF versions 1, 2, and 3 will be removed in a future version of Storybook. Upgrade to CSF 4: https://storybook.js.org/docs/writing-stories/csf#upgrade-to-csf-4
export default {
  component: 'demo-button',
  globals: {
    // 👇 Set background value for all component stories
    backgrounds: { value: 'gray', grid: false },
  },
};

export const OnDark = {
  globals: {
    // 👇 Override background value for this story
    backgrounds: { value: 'dark' },
  },
};
```
