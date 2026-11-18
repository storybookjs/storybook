```svelte filename="YourComponent.stories.svelte" renderer="svelte" language="js" tabTitle="CSF 4"
<script module>
  import { setContext } from 'svelte';

  import preview from '../.storybook/preview';

  import YourComponent from './YourComponent.svelte';
  import MarginDecorator from './MarginDecorator.svelte';

  const { Story } = preview.meta({
    component: YourComponent,
    decorators: [
      (story, { globals }) => {
        const marginSize = globals.marginSize === 'small' ? 'small' : 'medium';
        setContext('marginSize', marginSize);
        return { Component: MarginDecorator };
      },
    ],
  });
</script>
```

```svelte filename="YourComponent.stories.svelte" renderer="svelte" language="js" tabTitle="CSF 3"
<!-- ⚠️ CSF versions 1, 2, and 3 will be removed in a future version of Storybook. Upgrade to CSF 4: https://storybook.js.org/docs/writing-stories/csf#upgrade-to-csf-4 -->
<script module>
  import { setContext } from 'svelte';

  // Replace your-framework with the framework you are using, e.g. sveltekit or svelte-vite
  import { defineMeta } from '@storybook/your-framework';

  import YourComponent from './YourComponent.svelte';
  import MarginDecorator from './MarginDecorator.svelte';

  const { Story } = defineMeta({
    component: YourComponent,
    decorators: [
      (story, { globals }) => {
        const marginSize = globals.marginSize === 'small' ? 'small' : 'medium';
        setContext('marginSize', marginSize);
        return { Component: MarginDecorator };
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

```svelte filename="YourComponent.stories.svelte" renderer="svelte" language="ts" tabTitle="CSF 4"
<script module lang="ts">
  import { setContext } from 'svelte';

  import preview from '../.storybook/preview';

  import YourComponent from './YourComponent.svelte';
  import MarginDecorator from './MarginDecorator.svelte';

  const { Story } = preview.meta({
    component: YourComponent,
    decorators: [
      (story, { globals }) => {
        const marginSize = globals.marginSize === 'small' ? 'small' : 'medium';
        setContext('marginSize', marginSize);
        return { Component: MarginDecorator };
      },
    ],
  });
</script>
```

```svelte filename="YourComponent.stories.svelte" renderer="svelte" language="ts" tabTitle="CSF 3"
<!-- ⚠️ CSF versions 1, 2, and 3 will be removed in a future version of Storybook. Upgrade to CSF 4: https://storybook.js.org/docs/writing-stories/csf#upgrade-to-csf-4 -->
<script module lang="ts">
  import { setContext } from 'svelte';

  // Replace your-framework with the framework you are using, e.g. sveltekit or svelte-vite
  import { defineMeta } from '@storybook/your-framework';

  import YourComponent from './YourComponent.svelte';
  import MarginDecorator from './MarginDecorator.svelte';

  const { Story } = defineMeta({
    component: YourComponent,
    decorators: [
      (story, { globals }) => {
        const marginSize = globals.marginSize === 'small' ? 'small' : 'medium';
        setContext('marginSize', marginSize);
        return { Component: MarginDecorator };
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
