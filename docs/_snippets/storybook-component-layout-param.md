```ts filename="Button.stories.ts" renderer="angular" language="ts"
import type { Meta } from '@storybook/angular';

import { Button } from './button.component';

const meta: Meta<Button> = {
  component: Button,
  // Sets the layout parameter component wide.
  parameters: {
    layout: 'centered',
  },
};
```

```svelte filename="Button.stories.svelte" renderer="svelte" language="js" tabTitle="Svelte CSF"
<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf';

  import Button from './Button.svelte';

  const { Story } = defineMeta({
    component: Button,
    // Sets the layout parameter component wide.
    parameters: {
      layout: 'centered',
    },
  });
</script>
```

```js filename="Button.stories.js" renderer="svelte" language="js" tabTitle="CSF"
import Button from './Button.svelte';

export default {
  component: Button,
  // Sets the layout parameter component wide.
  parameters: {
    layout: 'centered',
  },
};
```

```js filename="Button.stories.js|jsx" renderer="common" language="js"
import { Button } from './Button';

export default {
  component: Button,
  // Sets the layout parameter component wide.
  parameters: {
    layout: 'centered',
  },
};
```

```svelte filename="Button.stories.svelte" renderer="svelte" language="ts" tabTitle="Svelte CSF"
<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf';

  import Button from './Button.svelte';

  const { Story } = defineMeta({
    component: Button,
    // Sets the layout parameter component wide.
    parameters: {
      layout: 'centered',
    },
  });
</script>
```

```ts filename="Button.stories.ts" renderer="svelte" language="ts" tabTitle="CSF"
// Replace your-framework with svelte-vite or sveltekit
import type { Meta } from '@storybook/your-framework';

import Button from './Button.svelte';

const meta = {
  component: Button,
  // Sets the layout parameter component wide.
  parameters: {
    layout: 'centered',
  },
} satisfies Meta<typeof Button>;

export default meta;
```

```js filename="Button.stories.js" renderer="web-components" language="js"
export default {
  component: 'demo-button',
  // Sets the layout parameter component wide.
  parameters: {
    layout: 'centered',
  },
};
```

```ts filename="Button.stories.ts|tsx" renderer="common" language="ts"
// Replace your-framework with the framework you are using, e.g. react-vite, nextjs, vue3-vite, etc.
import type { Meta } from '@storybook/your-framework';

import { Button } from './Button';

const meta = {
  component: Button,
  // Sets the layout parameter component wide.
  parameters: {
    layout: 'centered',
  },
} satisfies Meta<typeof Button>;

export default meta;
```

```ts filename="Button.stories.ts" renderer="web-components" language="ts"
import type { Meta } from '@storybook/web-components-vite';

const meta: Meta = {
  component: 'demo-button',
  // Sets the layout parameter component wide.
  parameters: {
    layout: 'centered',
  },
};

export default meta;
```
