```ts filename="Button.stories.ts" renderer="angular" language="ts"
import type { Meta } from '@storybook/angular';

import { Button } from './button.component';

const meta: Meta<Button> = {
  component: Button,
  argTypes: {
    label: { control: 'text' }, // Always shows the control
    advanced: { control: 'boolean' },
    // Only enabled if advanced is true
    margin: { control: 'number', if: { arg: 'advanced' } },
    padding: { control: 'number', if: { arg: 'advanced' } },
    cornerRadius: { control: 'number', if: { arg: 'advanced' } },
  },
};

export default meta;
```

```svelte filename="Button.stories.svelte" renderer="svelte" language="js" tabTitle="Svelte CSF"
<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf';

  import Button from './Button.svelte';

  const { Story } = defineMeta({
    component: Button,
    argTypes: {
      label: { control: 'text' }, // Always shows the control
      advanced: { control: 'boolean' },
      // Only enabled if advanced is true
      margin: { control: 'number', if: { arg: 'advanced' } },
      padding: { control: 'number', if: { arg: 'advanced' } },
      cornerRadius: { control: 'number', if: { arg: 'advanced' } },
    },
  });
</script>
```

```js filename="Button.stories.js" renderer="svelte" language="js" tabTitle="CSF"
import Button from './Button.svelte';

export default {
  component: Button,
  argTypes: {
    label: { control: 'text' }, // Always shows the control
    advanced: { control: 'boolean' },
    // Only enabled if advanced is true
    margin: { control: 'number', if: { arg: 'advanced' } },
    padding: { control: 'number', if: { arg: 'advanced' } },
    cornerRadius: { control: 'number', if: { arg: 'advanced' } },
  },
};
```

```js filename="Button.stories.js|jsx" renderer="common" language="js"
import { Button } from './Button';

export default {
  component: Button,
  argTypes: {
    label: { control: 'text' }, // Always shows the control
    advanced: { control: 'boolean' },
    // Only enabled if advanced is true
    margin: { control: 'number', if: { arg: 'advanced' } },
    padding: { control: 'number', if: { arg: 'advanced' } },
    cornerRadius: { control: 'number', if: { arg: 'advanced' } },
  },
};
```

```svelte filename="Button.stories.svelte" renderer="svelte" language="ts-4-9" tabTitle="Svelte CSF"
<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf';

  import Button from './Button.svelte';

  const { Story } = defineMeta({
    component: Button,
    argTypes: {
      label: { control: 'text' }, // Always shows the control
      advanced: { control: 'boolean' },
      // Only enabled if advanced is true
      margin: { control: 'number', if: { arg: 'advanced' } },
      padding: { control: 'number', if: { arg: 'advanced' } },
      cornerRadius: { control: 'number', if: { arg: 'advanced' } },
    },
  });
</script>
```

```ts filename="Button.stories.ts" renderer="svelte" language="ts-4-9" tabTitle="CSF"
import type { Meta } from '@storybook/svelte';

import Button from './Button.svelte';

const meta = {
  component: Button,
  argTypes: {
    label: { control: 'text' }, // Always shows the control
    advanced: { control: 'boolean' },
    // Only enabled if advanced is true
    margin: { control: 'number', if: { arg: 'advanced' } },
    padding: { control: 'number', if: { arg: 'advanced' } },
    cornerRadius: { control: 'number', if: { arg: 'advanced' } },
  },
} satisfies Meta<typeof Button>;

export default meta;
```

```ts filename="Button.stories.ts|tsx" renderer="common" language="ts-4-9"
// Replace your-framework with the name of your framework
import type { Meta } from '@storybook/your-framework';

import { Button } from './Button';

const meta = {
  component: Button,
  argTypes: {
    label: { control: 'text' }, // Always shows the control
    advanced: { control: 'boolean' },
    // Only enabled if advanced is true
    margin: { control: 'number', if: { arg: 'advanced' } },
    padding: { control: 'number', if: { arg: 'advanced' } },
    cornerRadius: { control: 'number', if: { arg: 'advanced' } },
  },
} satisfies Meta<typeof Button>;

export default meta;
```

```svelte filename="Button.stories.svelte" renderer="svelte" language="ts" tabTitle="Svelte CSF"
<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf';

  import Button from './Button.svelte';

  const { Story } = defineMeta({
    component: Button,
    argTypes: {
      label: { control: 'text' }, // Always shows the control
      advanced: { control: 'boolean' },
      // Only enabled if advanced is true
      margin: { control: 'number', if: { arg: 'advanced' } },
      padding: { control: 'number', if: { arg: 'advanced' } },
      cornerRadius: { control: 'number', if: { arg: 'advanced' } },
    },
  });
</script>
```

```ts filename="Button.stories.ts" renderer="svelte" language="ts" tabTitle="CSF"
import type { Meta } from '@storybook/svelte';

import Button from './Button.svelte';

const meta: Meta<typeof Button> = {
  component: Button,
  argTypes: {
    label: { control: 'text' }, // Always shows the control
    advanced: { control: 'boolean' },
    // Only enabled if advanced is true
    margin: { control: 'number', if: { arg: 'advanced' } },
    padding: { control: 'number', if: { arg: 'advanced' } },
    cornerRadius: { control: 'number', if: { arg: 'advanced' } },
  },
};

export default meta;
```

```ts filename="Button.stories.ts|tsx" renderer="common" language="ts"
// Replace your-framework with the name of your framework
import type { Meta } from '@storybook/your-framework';

import { Button } from './Button';

const meta: Meta<typeof Button> = {
  component: Button,
  argTypes: {
    label: { control: 'text' }, // Always shows the control
    advanced: { control: 'boolean' },
    // Only enabled if advanced is true
    margin: { control: 'number', if: { arg: 'advanced' } },
    padding: { control: 'number', if: { arg: 'advanced' } },
    cornerRadius: { control: 'number', if: { arg: 'advanced' } },
  },
};

export default meta;
```

```js filename="Button.stories.js" renderer="web-components" language="js"
export default {
  component: 'demo-button',
  argTypes: {
    label: { control: 'text' }, // Always shows the control
    advanced: { control: 'boolean' },
    // Only enabled if advanced is true
    margin: { control: 'number', if: { arg: 'advanced' } },
    padding: { control: 'number', if: { arg: 'advanced' } },
    cornerRadius: { control: 'number', if: { arg: 'advanced' } },
  },
};
```

```ts filename="Button.stories.ts" renderer="web-components" language="ts"
import type { Meta } from '@storybook/web-components';

const meta: Meta = {
  component: 'demo-button',
  argTypes: {
    label: { control: 'text' }, // Always shows the control
    advanced: { control: 'boolean' },
    // Only enabled if advanced is true
    margin: { control: 'number', if: { arg: 'advanced' } },
    padding: { control: 'number', if: { arg: 'advanced' } },
    cornerRadius: { control: 'number', if: { arg: 'advanced' } },
  },
};

export default meta;
```
