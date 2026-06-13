```svelte filename="YourComponent.stories.svelte" renderer="svelte" language="js" tabTitle="Svelte CSF"
<script module>
  import { setContext } from 'svelte';
  import { defineMeta } from '@storybook/addon-svelte-csf';

  import YourComponent from './YourComponent.svelte';
  import MarginDecorator from './MarginDecorator.svelte';

  const { Story } = defineMeta({
    component: YourComponent,
    decorators: [
      (_, { globals }) => {
        const marginSize = globals.marginSize === 'small' ? 'small' : 'medium';
        setContext('marginSize', marginSize);
        return MarginDecorator;
      },
    ],
  });
</script>
```

```svelte filename="MarginDecorator.svelte" renderer="svelte" language="js" tabTitle="Decorator component"
<script>
  import { getContext } from 'svelte';

  let { children } = $props();

  const size = getContext('marginSize') || 'medium';
  const margin = size === 'small' ? '1rem' : '3rem';
</script>

<div style="margin: {margin};">
  {@render children?.()}
</div>
```

```js filename="YourComponent.stories.js" renderer="svelte" language="js" tabTitle="CSF 3"
import { setContext } from 'svelte';

import YourComponent from './YourComponent.svelte';
import MarginDecorator from './MarginDecorator.svelte';

export default {
  component: YourComponent,
  decorators: [
    (_, { globals }) => {
      const marginSize = globals.marginSize === 'small' ? 'small' : 'medium';
      setContext('marginSize', marginSize);
      return MarginDecorator;
    },
  ],
};
```

```svelte filename="YourComponent.stories.svelte" renderer="svelte" language="ts" tabTitle="Svelte CSF"
<script module lang="ts">
  import { setContext } from 'svelte';
  import { defineMeta } from '@storybook/addon-svelte-csf';

  import YourComponent from './YourComponent.svelte';
  import MarginDecorator from './MarginDecorator.svelte';

  const { Story } = defineMeta({
    component: YourComponent,
    decorators: [
      (_, { globals }) => {
        const marginSize = globals.marginSize === 'small' ? 'small' : 'medium';
        setContext('marginSize', marginSize);
        return MarginDecorator;
      },
    ],
  });
</script>
```

```svelte filename="MarginDecorator.svelte" renderer="svelte" language="ts" tabTitle="Decorator component"
<script lang="ts">
  import { getContext, type Snippet } from 'svelte';

  interface Props {
    children?: Snippet;
  }

  let { children }: Props = $props();

  const size = getContext<'small' | 'medium'>('marginSize') ?? 'medium';
  const margin = size === 'small' ? '1rem' : '3rem';
</script>

<div style="margin: {margin};">
  {@render children?.()}
</div>
```

```ts filename="YourComponent.stories.ts" renderer="svelte" language="ts" tabTitle="CSF 3"
// Replace your-framework with svelte-vite or sveltekit
import type { Meta } from '@storybook/your-framework';
import { setContext } from 'svelte';

import YourComponent from './YourComponent.svelte';
import MarginDecorator from './MarginDecorator.svelte';

const meta = {
  component: YourComponent,
  decorators: [
    (_, { globals }) => {
      const marginSize = globals.marginSize === 'small' ? 'small' : 'medium';
      setContext('marginSize', marginSize);
      return MarginDecorator;
    },
  ],
} satisfies Meta<typeof YourComponent>;

export default meta;
```
