```ts filename="MyComponent.stories.ts" renderer="angular" language="ts"
import type { Meta } from '@storybook/angular';

import { MyComponent } from './MyComponent.component';

const meta: Meta<MyComponent> = {
  component: MyComponent,
  tags: ['autodocs'],
  parameters: {
    docs: {
      toc: {
        disable: true, // 👈 Disables the table of contents
      },
    },
  },
};

export default meta;
```

```svelte filename="MyComponent.stories.svelte" renderer="svelte" language="js" tabTitle="Svelte CSF"
<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf';

  import MyComponent from './MyComponent.svelte';

  const { Story } = defineMeta({
    component: MyComponent,
    tags: ['autodocs'],
    parameters: {
      docs: {
        toc: {
          disable: true, // 👈 Disables the table of contents
        },
      },
    },
  });
</script>
```

```js filename="MyComponent.stories.js" renderer="svelte" language="js" tabTitle="CSF"
import MyComponent from './MyComponent.svelte';

export default {
  component: MyComponent,
  tags: ['autodocs'],
  parameters: {
    docs: {
      toc: {
        disable: true, // 👈 Disables the table of contents
      },
    },
  },
};
```

```js filename="MyComponent.stories.js" renderer="common" language="js"
import { MyComponent } from './MyComponent';

export default {
  component: MyComponent,
  tags: ['autodocs'],
  parameters: {
    docs: {
      toc: {
        disable: true, // 👈 Disables the table of contents
      },
    },
  },
};
```

```svelte filename="MyComponent.stories.svelte" renderer="svelte" language="ts" tabTitle="Svelte CSF"
<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf';

  import MyComponent from './MyComponent.svelte';

  const { Story } = defineMeta({
    component: MyComponent,
    tags: ['autodocs'],
    parameters: {
      docs: {
        toc: {
          disable: true, // 👈 Disables the table of contents
        },
      },
    },
  });
</script>
```

```ts filename="MyComponent.stories.ts" renderer="svelte" language="ts" tabTitle="CSF"
// Replace your-framework with svelte-vite or sveltekit
import type { Meta } from '@storybook/your-framework';

import MyComponent from './MyComponent.svelte';

const meta = {
  component: MyComponent,
  tags: ['autodocs'],
  parameters: {
    docs: {
      toc: {
        disable: true, // 👈 Disables the table of contents
      },
    },
  },
} satisfies Meta<typeof MyComponent>;

export default meta;
```

```ts filename="MyComponent.stories.ts|tsx" renderer="common" language="ts"
// Replace your-framework with the framework you are using, e.g. react-vite, nextjs, vue3-vite, etc.
import type { Meta } from '@storybook/your-framework';

import { MyComponent } from './MyComponent';

const meta = {
  component: MyComponent,
  tags: ['autodocs'],
  parameters: {
    docs: {
      toc: {
        disable: true, // 👈 Disables the table of contents
      },
    },
  },
} satisfies Meta<typeof MyComponent>;

export default meta;
```

```js filename="MyComponent.stories.js" renderer="web-components" language="js"
export default {
  component: 'my-component',
  tags: ['autodocs'],
  parameters: {
    docs: {
      toc: {
        disable: true, // 👈 Disables the table of contents
      },
    },
  },
};
```

```ts filename="MyComponent.stories.ts" renderer="web-components" language="ts"
import type { Meta } from '@storybook/web-components-vite';

const meta: Meta = {
  component: 'my-component',
  tags: ['autodocs'],
  parameters: {
    docs: {
      toc: {
        disable: true, // 👈 Disables the table of contents
      },
    },
  },
};

export default meta;
```
