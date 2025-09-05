```ts filename="Example.stories.ts" renderer="angular" language="ts"
import type { Meta } from '@storybook/angular';

import { Example } from './Example';

const meta: Meta<Example> = {
  component: Example,
  argTypes: {
    value: {
      table: {
        defaultValue: { summary: 0 },
        type: { summary: 'number' },
      },
    },
  },
};

export default meta;
```

```svelte filename="Example.stories.svelte" renderer="svelte" language="js" tabTitle="Svelte CSF"
<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf';

  import Example from './Example.svelte';

  const { Story } = defineMeta({
    component: Example,
    argTypes: {
      value: {
        table: {
          defaultValue: { summary: 0 },
          type: { summary: 'number' },
        },
      },
    },
  });
</script>
```

```js filename="Example.stories.js" renderer="svelte" language="js" tabTitle="CSF"
import Example from './Example.svelte';

export default {
  component: Example,
  argTypes: {
    value: {
      table: {
        defaultValue: { summary: 0 },
        type: { summary: 'number' },
      },
    },
  },
};
```

```js filename="Example.stories.js|jsx" renderer="common" language="js"
import { Example } from './Example';

export default {
  component: Example,
  argTypes: {
    value: {
      table: {
        defaultValue: { summary: 0 },
        type: { summary: 'number' },
      },
    },
  },
};
```

```svelte filename="Example.stories.svelte" renderer="svelte" language="ts" tabTitle="Svelte CSF"
<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf';

  import Example from './Example.svelte';

  const { Story } = defineMeta({
    component: Example,
    argTypes: {
      value: {
        table: {
          defaultValue: { summary: 0 },
          type: { summary: 'number' },
        },
      },
    },
  });
</script>
```

```ts filename="Example.stories.ts" renderer="svelte" language="ts" tabTitle="CSF"
// Replace your-framework with svelte-vite or sveltekit
import type { Meta } from '@storybook/your-framework';

import { Example } from './Example';

const meta = {
  component: Example,
  argTypes: {
    value: {
      table: {
        defaultValue: { summary: 0 },
        type: { summary: 'number' },
      },
    },
  },
} satisfies Meta<typeof Example>;

export default meta;
```

```ts filename="Example.stories.ts|tsx" renderer="common" language="ts"
// Replace your-framework with the framework you are using, e.g. react-vite, nextjs, vue3-vite, etc.
import type { Meta } from '@storybook/your-framework';

import { Example } from './Example';

const meta = {
  component: Example,
  argTypes: {
    value: {
      table: {
        defaultValue: { summary: 0 },
        type: { summary: 'number' },
      },
    },
  },
} satisfies Meta<typeof Example>;

export default meta;
```

```js filename="Example.stories.js" renderer="web-components" language="js"
export default {
  component: 'demo-example',
  argTypes: {
    value: {
      table: {
        defaultValue: { summary: 0 },
        type: { summary: 'number' },
      },
    },
  },
};
```

```ts filename="Example.stories.ts" renderer="web-components" language="ts"
import type { Meta } from '@storybook/web-components-vite';

const meta: Meta = {
  component: 'demo-example',
  argTypes: {
    value: {
      table: {
        defaultValue: { summary: 0 },
        type: { summary: 'number' },
      },
    },
  },
};

export default meta;
```
