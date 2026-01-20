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
      hrefs: {
        '/basic-href': (to, event) => {
          console.log(to, event);
        },
        '/root.*': {
          callback: (to, event) => {
            console.log(to, event);
          },
          asRegex: true,
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
      hrefs: {
        '/basic-href': (to, event) => {
          console.log(to, event);
        },
        '/root.*': {
          callback: (to, event) => {
            console.log(to, event);
          },
          asRegex: true,
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
      hrefs: {
        '/basic-href': (to, event) => {
          console.log(to, event);
        },
        '/root.*': {
          callback: (to, event) => {
            console.log(to, event);
          },
          asRegex: true,
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
      hrefs: {
        '/basic-href': (to, event) => {
          console.log(to, event);
        },
        '/root.*': {
          callback: (to, event) => {
            console.log(to, event);
          },
          asRegex: true,
        },
      },
    },
  },
};
```
