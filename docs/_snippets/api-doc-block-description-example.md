```ts filename="Button.stories.ts" renderer="angular" language="ts" tabTitle="CSF 4"
import preview from '../.storybook/preview';

import { Button } from './button.component';

/**
 * Button stories
 * These stories showcase the button
 */
const meta = preview.meta({
  component: Button,
  parameters: {
    docs: {
      description: {
        component: 'Another description, overriding the comments',
      },
    },
  },
});

/**
 * Primary Button
 * This is the primary button
 */
export const Primary = meta.story({
  parameters: {
    docs: {
      description: {
        story: 'Another description on the story, overriding the comments',
      },
    },
  },
});
```

```ts filename="Button.stories.ts" renderer="web-components" language="ts" tabTitle="CSF 4"
import preview from '../.storybook/preview';

/**
 * Button stories
 * These stories showcase the button
 */
const meta = preview.meta({
  title: 'Button',
  component: 'demo-button',
  parameters: {
    docs: {
      description: {
        component: 'Another description, overriding the comments',
      },
    },
  },
});

/**
 * Primary Button
 * This is the primary button
 */
export const Primary = meta.story({
  parameters: {
    docs: {
      description: {
        story: 'Another description on the story, overriding the comments',
      },
    },
  },
});
```

```svelte filename="Button.stories.svelte" renderer="svelte" language="js" tabTitle="CSF 4"
<script module>
  import preview from '../.storybook/preview';

  import Button from './Button.svelte';

  /**
   * Button stories
   * These stories showcase the button
   */
  const { Story } = preview.meta({
    component: Button,
    parameters: {
      docs: {
        description: {
          component: 'Another description, overriding the comments',
        },
      },
    },
  });
</script>

<!--
 Button stories
 These stories showcase the button
 -->

<Story
  name="Primary"
  parameters={{
    docs: {
      description: {
        story: 'Another description on the story, overriding the comments'
      },
    },
  }} />
```

```svelte filename="Button.stories.svelte" renderer="svelte" language="js" tabTitle="CSF 3"
<!-- ⚠️ CSF 3 is deprecated and will be removed in Storybook 12 -->
<script module>
  // Replace your-framework with the framework you are using, e.g. sveltekit or svelte-vite
  import { defineMeta } from '@storybook/your-framework';

  import Button from './Button.svelte';

  /**
   * Button stories
   * These stories showcase the button
   */
  const { Story } = defineMeta({
    component: Button,
    parameters: {
      docs: {
        description: {
          component: 'Another description, overriding the comments',
        },
      },
    },
  });
</script>

<!--
 Button stories
 These stories showcase the button
 -->

<Story
  name="Primary"
  parameters={{
    docs: {
      description: {
        story: 'Another description on the story, overriding the comments'
      },
    },
  }} />
```

```js filename="Button.stories.js" renderer="web-components" language="js" tabTitle="CSF 4"
import preview from '../.storybook/preview';

/**
 * Button stories
 * These stories showcase the button
 */
const meta = preview.meta({
  title: 'Button',
  component: 'demo-button',
  parameters: {
    docs: {
      description: {
        component: 'Another description, overriding the comments',
      },
    },
  },
});

/**
 * # Button stories
 * These stories showcase the button
 */
export const Primary = meta.story({
  parameters: {
    docs: {
      description: {
        story: 'Another description on the story, overriding the comments',
      },
    },
  },
});
```

```svelte filename="Button.stories.svelte" renderer="svelte" language="ts" tabTitle="CSF 4"
<script module lang="ts">
  import preview from '../.storybook/preview';

  import Button from './Button.svelte';

  /**
   * Button stories
   * These stories showcase the button
   */
  const { Story } = preview.meta({
    component: Button,
    parameters: {
      docs: {
        description: {
          component: 'Another description, overriding the comments',
        },
      },
    },
  });
</script>

<!--
 Button stories
 These stories showcase the button
 -->

<Story
  name="Primary"
  parameters={{
    docs: {
      description: {
        story: 'Another description on the story, overriding the comments'
      },
    },
  }} />
```

```svelte filename="Button.stories.svelte" renderer="svelte" language="ts" tabTitle="CSF 3"
<!-- ⚠️ CSF 3 is deprecated and will be removed in Storybook 12 -->
<script module>
  // Replace your-framework with the framework you are using, e.g. sveltekit or svelte-vite
  import { defineMeta } from '@storybook/your-framework';

  import Button from './Button.svelte';

  /**
   * Button stories
   * These stories showcase the button
   */
  const { Story } = defineMeta({
    component: Button,
    parameters: {
      docs: {
        description: {
          component: 'Another description, overriding the comments',
        },
      },
    },
  });
</script>

<!--
 Button stories
 These stories showcase the button
 -->

<Story
  name="Primary"
  parameters={{
    docs: {
      description: {
        story: 'Another description on the story, overriding the comments'
      },
    },
  }} />
```

```ts filename="Button.stories.ts|tsx" renderer="react" language="ts" tabTitle="CSF 4"
import preview from '../.storybook/preview';

import { Button } from './Button';

/**
 * Button stories
 * These stories showcase the button
 */
const meta = preview.meta({
  component: Button,
  parameters: {
    docs: {
      description: {
        component: 'Another description, overriding the comments',
      },
    },
  },
});

/**
 * Primary Button
 * This is the primary button
 */
export const Primary = meta.story({
  parameters: {
    docs: {
      description: {
        story: 'Another description on the story, overriding the comments',
      },
    },
  },
});
```

```js filename="Button.stories.js|jsx" renderer="react" language="js" tabTitle="CSF 4"
import preview from '../.storybook/preview';

import { Button } from './Button';

const meta = preview.meta({
  component: Button,
  parameters: {
    docs: {
      description: {
        component: 'Another description, overriding the comments',
      },
    },
  },
});

/**
 * Primary Button
 * This is the primary button
 */
export const Primary = meta.story({
  parameters: {
    docs: {
      description: {
        story: 'Another description on the story, overriding the comments',
      },
    },
  },
});
```

```ts filename="Button.stories.ts" renderer="vue" language="ts" tabTitle="CSF 4"
import preview from '../.storybook/preview';

import Button from './Button.vue';

/**
 * Button stories
 * These stories showcase the button
 */
const meta = preview.meta({
  component: Button,
  parameters: {
    docs: {
      description: {
        component: 'Another description, overriding the comments',
      },
    },
  },
});

/**
 * Primary Button
 * This is the primary button
 */
export const Primary = meta.story({
  parameters: {
    docs: {
      description: {
        story: 'Another description on the story, overriding the comments',
      },
    },
  },
});
```

```js filename="Button.stories.js" renderer="vue" language="js" tabTitle="CSF 4"
import preview from '../.storybook/preview';

import Button from './Button.vue';

/**
 * Button stories
 * These stories showcase the button
 */
const meta = preview.meta({
  component: Button,
  parameters: {
    docs: {
      description: {
        component: 'Another description, overriding the comments',
      },
    },
  },
});

/**
 * Primary Button
 * This is the primary button
 */
export const Primary = meta.story({
  parameters: {
    docs: {
      description: {
        story: 'Another description on the story, overriding the comments',
      },
    },
  },
});
```

```ts filename="Button.stories.ts" renderer="angular" language="ts" tabTitle="CSF 3"
// ⚠️ CSF versions 1, 2, and 3 will be removed in a future version of Storybook. Upgrade to CSF 4: https://storybook.js.org/docs/writing-stories/csf#upgrade-to-csf-4
import type { Meta, StoryObj } from '@storybook/angular';

import { Button } from './button.component';

/**
 * Button stories
 * These stories showcase the button
 */
const meta: Meta<Button> = {
  component: Button,
  parameters: {
    docs: {
      description: {
        component: 'Another description, overriding the comments',
      },
    },
  },
};

export default meta;
type Story = StoryObj<Button>;

/**
 * Primary Button
 * This is the primary button
 */
export const Primary: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Another description on the story, overriding the comments',
      },
    },
  },
};
```

```ts filename="Button.stories.ts|tsx" renderer="common" language="ts" tabTitle="CSF 3"
// ⚠️ CSF versions 1, 2, and 3 will be removed in a future version of Storybook. Upgrade to CSF 4: https://storybook.js.org/docs/writing-stories/csf#upgrade-to-csf-4
// Replace your-framework with the framework you are using, e.g. react-vite, nextjs, vue3-vite, etc.
import type { Meta, StoryObj } from '@storybook/your-framework';

import { Button } from './Button';

/**
 * Button stories
 * These stories showcase the button
 */
const meta = {
  component: Button,
  parameters: {
    docs: {
      description: {
        component: 'Another description, overriding the comments',
      },
    },
  },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Primary Button
 * This is the primary button
 */
export const Primary: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Another description on the story, overriding the comments',
      },
    },
  },
};
```

```js filename="Button.stories.js|jsx" renderer="common" language="js" tabTitle="CSF 3"
// ⚠️ CSF versions 1, 2, and 3 will be removed in a future version of Storybook. Upgrade to CSF 4: https://storybook.js.org/docs/writing-stories/csf#upgrade-to-csf-4
import { Button } from './Button';

/**
 * Button stories
 * These stories showcase the button
 */
export default {
  component: Button,
  parameters: {
    docs: {
      description: {
        component: 'Another description, overriding the comments',
      },
    },
  },
};

/**
 * Primary Button
 * This is the primary button
 */
export const Primary = {
  parameters: {
    docs: {
      description: {
        story: 'Another description on the story, overriding the comments',
      },
    },
  },
};
```

```ts filename="Button.stories.ts" renderer="web-components" language="ts" tabTitle="CSF 3"
// ⚠️ CSF versions 1, 2, and 3 will be removed in a future version of Storybook. Upgrade to CSF 4: https://storybook.js.org/docs/writing-stories/csf#upgrade-to-csf-4
import type { Meta, StoryObj } from '@storybook/web-components-vite';

/**
 * Button stories
 * These stories showcase the button
 */
const meta: Meta = {
  title: 'Button',
  component: 'demo-button',
  parameters: {
    docs: {
      description: {
        component: 'Another description, overriding the comments',
      },
    },
  },
};

export default meta;
type Story = StoryObj;

/**
 * Primary Button
 * This is the primary button
 */
export const Primary: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Another description on the story, overriding the comments',
      },
    },
  },
};
```

```js filename="Button.stories.js" renderer="web-components" language="js" tabTitle="CSF 3"
// ⚠️ CSF versions 1, 2, and 3 will be removed in a future version of Storybook. Upgrade to CSF 4: https://storybook.js.org/docs/writing-stories/csf#upgrade-to-csf-4
/**
 * Button stories
 * These stories showcase the button
 */
export default {
  title: 'Button',
  component: 'demo-button',
  parameters: {
    docs: {
      description: {
        component: 'Another description, overriding the comments',
      },
    },
  },
};

/**
 * # Button stories
 * These stories showcase the button
 */
export const Primary = {
  parameters: {
    docs: {
      description: {
        story: 'Another description on the story, overriding the comments',
      },
    },
  },
};
```
