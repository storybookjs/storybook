```svelte filename="MyComponent.stories.svelte" renderer="svelte" language="js" tabTitle="Svelte CSF"
<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf';

  import MyComponent from './MyComponent.svelte';

  const { Story } = defineMeta({
    component: MyComponent,
  });
</script>

<Story
  name="MyStory"
  parameters={{
    sveltekit_experimental: {
      state: {
        page: {
          data: {
            test: 'passed',
          },
        },
        navigating: {
          to: {
            route: { id: '/storybook' },
            params: {},
            url: new URL('http://localhost/storybook'),
          },
        },
        updated: {
          current: true,
        },
      },
    },
  }}
/>
```

```js filename="MyComponent.stories.js" renderer="svelte" language="js" tabTitle="CSF 3"
import MyComponent from './MyComponent.svelte';

export default {
  component: MyComponent,
};

export const MyStory = {
  parameters: {
    sveltekit_experimental: {
      state: {
        page: {
          data: {
            test: 'passed',
          },
        },
        navigating: {
          to: {
            route: { id: '/storybook' },
            params: {},
            url: new URL('http://localhost/storybook'),
          },
        },
        updated: {
          current: true,
        },
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
  });
</script>

<Story
  name="MyStory"
  parameters={{
    sveltekit_experimental: {
      state: {
        page: {
          data: {
            test: 'passed',
          },
        },
        navigating: {
          to: {
            route: { id: '/storybook' },
            params: {},
            url: new URL('http://localhost/storybook'),
          },
        },
        updated: {
          current: true,
        },
      },
    },
  }}
/>
```

```ts filename="MyComponent.stories.ts" renderer="svelte" language="ts" tabTitle="CSF 3"
import type { Meta, StoryObj } from '@storybook/sveltekit';

import MyComponent from './MyComponent.svelte';

const meta = {
  component: MyComponent,
} satisfies Meta<typeof MyComponent>;

export default meta;
type Story = StoryObj<typeof meta>;

export const MyStory: Story = {
  parameters: {
    sveltekit_experimental: {
      state: {
        page: {
          data: {
            test: 'passed',
          },
        },
        navigating: {
          to: {
            route: { id: '/storybook' },
            params: {},
            url: new URL('http://localhost/storybook'),
          },
        },
        updated: {
          current: true,
        },
      },
    },
  },
};
```
