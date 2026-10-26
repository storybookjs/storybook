```ts filename="Checkbox.stories.ts" renderer="angular" language="ts" tabTitle="CSF 4"
import preview from '../.storybook/preview';

import { Checkbox } from './checkbox.component';

const meta = preview.meta({
  component: Checkbox,
});

export const Unchecked = meta.story({
  args: {
    label: 'Unchecked',
  },
});
```

```ts filename="Checkbox.stories.ts" renderer="web-components" language="ts" tabTitle="CSF 4"
import preview from '../.storybook/preview';

const meta = preview.meta({
  component: 'demo-checkbox',
});

export const Unchecked = meta.story({
  args: {
    label: 'Unchecked',
  },
});
```

```svelte filename="Checkbox.stories.svelte" renderer="svelte" language="js" tabTitle="CSF 4"
<script module>
  import preview from '../.storybook/preview';

  import Checkbox from './Checkbox.svelte';

  const { Story } = preview.meta({
    component: Checkbox,
  });
</script>

<Story
  name="Unchecked"
  args={{
    label: 'Unchecked',
  }}
/>
```

```svelte filename="Checkbox.stories.svelte" renderer="svelte" language="js" tabTitle="CSF 3"
<!-- ⚠️ CSF 3 is deprecated and will be removed in Storybook 12 -->
<script module>
  // Replace your-framework with the framework you are using, e.g. sveltekit or svelte-vite
  import { defineMeta } from '@storybook/your-framework';

  import Checkbox from './Checkbox.svelte';

  const { Story } = defineMeta({
    component: Checkbox,
  });
</script>

<Story
  name="Unchecked"
  args={{
    label: 'Unchecked',
  }}
/>
```

```js filename="Checkbox.stories.js" renderer="web-components" language="js" tabTitle="CSF 4"
import preview from '../.storybook/preview';

const meta = preview.meta({
  component: 'demo-checkbox',
});

export const Unchecked = meta.story({
  args: {
    label: 'Unchecked',
  },
});
```

```svelte filename="Checkbox.stories.svelte" renderer="svelte" language="ts" tabTitle="CSF 4"
<script module lang="ts">
  import preview from '../.storybook/preview';

  import Checkbox from './Checkbox.svelte';

  const { Story } = preview.meta({
    component: Checkbox,
  });
</script>

<Story
  name="Unchecked"
  args={{
    label: 'Unchecked',
  }}
/>
```

```svelte filename="Checkbox.stories.svelte" renderer="svelte" language="ts" tabTitle="CSF 3"
<!-- ⚠️ CSF 3 is deprecated and will be removed in Storybook 12 -->
<script module>
  // Replace your-framework with the framework you are using, e.g. sveltekit or svelte-vite
  import { defineMeta } from '@storybook/your-framework';

  import Checkbox from './Checkbox.svelte';

  const { Story } = defineMeta({
    component: Checkbox,
  });
</script>

<Story
  name="Unchecked"
  args={{
    label: 'Unchecked',
  }}
/>
```

```ts filename="Checkbox.stories.ts|tsx" renderer="react" language="ts" tabTitle="CSF 4"
import preview from '../.storybook/preview';

import { Checkbox } from './Checkbox';

const meta = preview.meta({
  component: Checkbox,
});

export const Unchecked = meta.story({
  args: {
    label: 'Unchecked',
  },
});
```

```js filename="Checkbox.stories.js|jsx" renderer="react" language="js" tabTitle="CSF 4"
import preview from '../.storybook/preview';

import { Checkbox } from './Checkbox';

const meta = preview.meta({
  component: Checkbox,
});

export const Unchecked = meta.story({
  args: {
    label: 'Unchecked',
  },
});
```

```ts filename="Checkbox.stories.ts" renderer="vue" language="ts" tabTitle="CSF 4"
import preview from '../.storybook/preview';

import Checkbox from './Checkbox.vue';

const meta = preview.meta({
  component: Checkbox,
});

export const Unchecked = meta.story({
  args: {
    label: 'Unchecked',
  },
});
```

```js filename="Checkbox.stories.js" renderer="vue" language="js" tabTitle="CSF 4"
import preview from '../.storybook/preview';

import Checkbox from './Checkbox.vue';

const meta = preview.meta({
  component: Checkbox,
});

export const Unchecked = meta.story({
  args: {
    label: 'Unchecked',
  },
});
```

```ts filename="Checkbox.stories.ts" renderer="angular" language="ts" tabTitle="CSF 3"
// ⚠️ CSF versions 1, 2, and 3 will be removed in a future version of Storybook. Upgrade to CSF 4: https://storybook.js.org/docs/writing-stories/csf#upgrade-to-csf-4
import type { Meta, StoryObj } from '@storybook/angular';

import { Checkbox } from './checkbox.component';

const meta: Meta<Checkbox> = {
  component: Checkbox,
};

export default meta;
type Story = StoryObj<Checkbox>;

export const Unchecked: Story = {
  args: {
    label: 'Unchecked',
  },
};
```

```ts filename="Checkbox.stories.ts|tsx" renderer="common" language="ts" tabTitle="CSF 3"
// ⚠️ CSF versions 1, 2, and 3 will be removed in a future version of Storybook. Upgrade to CSF 4: https://storybook.js.org/docs/writing-stories/csf#upgrade-to-csf-4
// Replace your-framework with the framework you are using, e.g. react-vite, nextjs, vue3-vite, etc.
import type { Meta, StoryObj } from '@storybook/your-framework';

import { Checkbox } from './Checkbox';

const meta = {
  component: Checkbox,
} satisfies Meta<typeof Checkbox>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Unchecked: Story = {
  args: {
    label: 'Unchecked',
  },
};
```

```js filename="Checkbox.stories.js|jsx" renderer="common" language="js" tabTitle="CSF 3"
// ⚠️ CSF versions 1, 2, and 3 will be removed in a future version of Storybook. Upgrade to CSF 4: https://storybook.js.org/docs/writing-stories/csf#upgrade-to-csf-4
import { Checkbox } from './Checkbox';

export default {
  component: Checkbox,
};

export const Unchecked = {
  args: {
    label: 'Unchecked',
  },
};
```

```ts filename="Checkbox.stories.ts" renderer="web-components" language="ts" tabTitle="CSF 3"
// ⚠️ CSF versions 1, 2, and 3 will be removed in a future version of Storybook. Upgrade to CSF 4: https://storybook.js.org/docs/writing-stories/csf#upgrade-to-csf-4
import type { Meta, StoryObj } from '@storybook/web-components-vite';

const meta: Meta = {
  component: 'demo-checkbox',
};

export default meta;
type Story = StoryObj;

export const Unchecked: Story = {
  args: {
    label: 'Unchecked',
  },
};
```

```js filename="Checkbox.stories.js" renderer="web-components" language="js" tabTitle="CSF 3"
// ⚠️ CSF versions 1, 2, and 3 will be removed in a future version of Storybook. Upgrade to CSF 4: https://storybook.js.org/docs/writing-stories/csf#upgrade-to-csf-4
export default {
  component: 'demo-checkbox',
};

export const Unchecked = {
  args: {
    label: 'Unchecked',
  },
};
```
