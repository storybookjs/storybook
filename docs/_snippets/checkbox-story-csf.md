```ts filename="CheckBox.stories.ts" renderer="angular" language="ts"
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

```svelte filename="Checkbox.stories.svelte" renderer="svelte" language="js" tabTitle="Svelte CSF"
<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf';

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

```js filename="Checkbox.stories.js" renderer="svelte" language="js" tabTitle="CSF"
import Checkbox from './Checkbox.svelte';

export default {
  component: Checkbox,
};

export const Unchecked = {
  args: {
    label: 'Unchecked',
  },
};
```

```js filename="Checkbox.stories.js|jsx" renderer="common" language="js"
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

```svelte filename="Checkbox.stories.svelte" renderer="svelte" language="ts" tabTitle="Svelte CSF"
<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf';

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

```ts filename="Checkbox.stories.ts" renderer="svelte" language="ts" tabTitle="CSF"
// Replace your-framework with svelte-vite or sveltekit
import type { Meta, StoryObj } from '@storybook/your-framework';

import Checkbox from './Checkbox.svelte';

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

```ts filename="Checkbox.stories.ts|tsx" renderer="common" language="ts"
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

```js filename="Checkbox.stories.js" renderer="web-components" language="js"
export default {
  title: 'Checkbox',
  component: 'checkbox',
};

export const Unchecked = {
  args: {
    label: 'Unchecked',
  },
};
```

```ts filename="Checkbox.stories.ts" renderer="web-components" language="ts"
import type { Meta, StoryObj } from '@storybook/web-components-vite';

const meta: Meta = {
  component: 'checkbox-element',
};

export default meta;
type Story = StoryObj;

export const Unchecked: Story = {
  args: {
    label: 'Unchecked',
  },
};
```
