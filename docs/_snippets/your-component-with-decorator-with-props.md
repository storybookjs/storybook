```svelte filename="YourComponent.stories.svelte" renderer="svelte" language="js" tabTitle="Svelte CSF"
<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf';

  import YourComponent from './YourComponent.svelte';
  import MarginDecorator from './MarginDecorator.svelte';

  const { Story } = defineMeta({
    component: YourComponent,
    decorators: [
      ({ parameters }) => ({
        Component: MarginDecorator,
        // 👇 Pass props to the MarginDecorator component
        props: { size: parameters.smallMargin ? 'small' : 'medium' },
      })
    ],
  });
</script>
```

```js filename="YourComponent.stories.js" renderer="svelte" language="js" tabTitle="CSF"
import YourComponent from './YourComponent.svelte';
import MarginDecorator from './MarginDecorator.svelte';

export default {
  component: YourComponent,
  decorators: [
    ({ parameters }) => ({
      Component: MarginDecorator,
      // 👇 Pass props to the MarginDecorator component
      props: { size: parameters.smallMargin ? 'small' : 'medium' },
    }),
  ],
};
```

```svelte filename="YourComponent.stories.svelte" renderer="svelte" language="ts" tabTitle="Svelte CSF"
<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf';

  import YourComponent from './YourComponent.svelte';
  import MarginDecorator from './MarginDecorator.svelte';

  const { Story } = defineMeta({
    component: YourComponent,
    decorators: [
      ({ parameters }) => ({
        Component: MarginDecorator,
        // 👇 Pass props to the MarginDecorator component
        props: { size: parameters.smallMargin ? 'small' : 'medium' },
      })
    ],
  });
</script>
```

```ts filename="YourComponent.stories.ts" renderer="svelte" language="ts" tabTitle="CSF"
// Replace your-framework with svelte-vite or sveltekit
import type { Meta } from '@storybook/your-framework';

import YourComponent from './YourComponent.svelte';
import MarginDecorator from './MarginDecorator.svelte';

const meta = {
  component: YourComponent,
  decorators: [
    ({ parameters }) => ({
      Component: MarginDecorator,
      // 👇 Pass props to the MarginDecorator component
      props: { size: parameters.smallMargin ? 'small' : 'medium' },
    }),
  ],
} satisfies Meta<typeof YourComponent>;

export default meta;
```
