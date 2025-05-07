```ts filename="Button.stories.ts" renderer="angular" language="ts"
import type { Meta } from '@storybook/angular';

import { Button } from './button.component';

const meta: Meta<Button> = {
  component: Button,
  parameters: {
    backgrounds: {
      options: {
        // 👇 Override the default `dark` option
        dark: { name: 'Dark', value: '#000' },
        // 👇 Add a new option
        gray: { name: 'Gray', value: '#CCC' },
      },
    },
  },
};

export default meta;
```

```js filename="Button.stories.js" renderer="web-components" language="js"
export default {
  component: 'demo-button',
  parameters: {
    backgrounds: {
      options: {
        // 👇 Override the default `dark` option
        dark: { name: 'Dark', value: '#000' },
        // 👇 Add a new option
        gray: { name: 'Gray', value: '#CCC' },
      },
    },
  },
};
```

```ts filename="Button.stories.ts" renderer="web-components" language="ts"
import type { Meta } from '@storybook/web-components-vite';

const meta: Meta = {
  component: 'demo-button',
  parameters: {
    backgrounds: {
      options: {
        // 👇 Override the default `dark` option
        dark: { name: 'Dark', value: '#000' },
        // 👇 Add a new option
        gray: { name: 'Gray', value: '#CCC' },
      },
    },
  },
};

export default meta;
```

```js filename="Button.stories.js|jsx" renderer="react" language="js"
import { Button } from './Button';

export default {
  component: Button,
  parameters: {
    backgrounds: {
      options: {
        // 👇 Override the default `dark` option
        dark: { name: 'Dark', value: '#000' },
        // 👇 Add a new option
        gray: { name: 'Gray', value: '#CCC' },
      },
    },
  },
};
```

```ts filename="Button.stories.ts|tsx" renderer="react" language="ts"
import type { Meta } from '@storybook/react-vite';

import { Button } from './Button';

const meta = {
  component: Button,
  parameters: {
    backgrounds: {
      options: {
        // 👇 Override the default `dark` option
        dark: { name: 'Dark', value: '#000' },
        // 👇 Add a new option
        gray: { name: 'Gray', value: '#CCC' },
      },
    },
  },
} satisfies Meta<typeof Button>;

export default meta;
```

```js filename="Button.stories.js" renderer="vue" language="js"
import Button from './Button.vue';

export default {
  component: Button,
  parameters: {
    backgrounds: {
      options: {
        // 👇 Override the default `dark` option
        dark: { name: 'Dark', value: '#000' },
        // 👇 Add a new option
        gray: { name: 'Gray', value: '#CCC' },
      },
    },
  },
};
```

```ts filename="Button.stories.ts" renderer="vue" language="ts"
import type { Meta } from '@storybook/vue3-vite';

import Button from './Button.vue';

const meta = {
  component: Button,
  parameters: {
    backgrounds: {
      options: {
        // 👇 Override the default `dark` option
        dark: { name: 'Dark', value: '#000' },
        // 👇 Add a new option
        gray: { name: 'Gray', value: '#CCC' },
      },
    },
  },
} satisfies Meta<typeof Button>;

export default meta;
```

```svelte filename="Button.stories.svelte" renderer="svelte" language="js" tabTitle="Svelte CSF"
<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf';

  import Button from './Button.svelte';

  const { Story } = defineMeta({
    component: Button,
    parameters: {
      backgrounds: {
        options: {
          // 👇 Override the default `dark` option
          dark: { name: 'Dark', value: '#000' },
          // 👇 Add a new option
          gray: { name: 'Gray', value: '#CCC' },
        },
      },
    },
  });
</script>
```

```js filename="Button.stories.js" renderer="svelte" language="js" tabTitle="CSF"
import Button from './Button.svelte';

export default {
  component: Button,
  parameters: {
    backgrounds: {
      options: {
        // 👇 Override the default `dark` option
        dark: { name: 'Dark', value: '#000' },
        // 👇 Add a new option
        gray: { name: 'Gray', value: '#CCC' },
      },
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
      backgrounds: {
        options: {
          // 👇 Override the default `dark` option
          dark: { name: 'Dark', value: '#000' },
          // 👇 Add a new option
          gray: { name: 'Gray', value: '#CCC' },
        },
      },
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
  parameters: {
    backgrounds: {
      options: {
        // 👇 Override the default `dark` option
        dark: { name: 'Dark', value: '#000' },
        // 👇 Add a new option
        gray: { name: 'Gray', value: '#CCC' },
      },
    },
  },
} satisfies Meta<typeof Button>;

export default meta;
```
