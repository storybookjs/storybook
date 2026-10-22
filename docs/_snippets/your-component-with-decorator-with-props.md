```svelte filename="YourComponent.stories.svelte" renderer="svelte" language="js" tabTitle="Svelte CSF 4"
<script module>
  import preview from '../.storybook/preview';

  import YourComponent from './YourComponent.svelte';
  import MarginDecorator from './MarginDecorator.svelte';

  const { Story } = preview.meta({
    component: YourComponent,
    decorators: [
      (story, { parameters }) => ({
        Component: MarginDecorator,
        // 👇 Pass props to the MarginDecorator component
        props: { size: parameters.smallMargin ? 'small' : 'medium' },
      })
    ],
  });
</script>
```

```svelte filename="YourComponent.stories.svelte" renderer="svelte" language="js" tabTitle="Svelte CSF 3"
<!-- ⚠️ CSF 3 is deprecated and will be removed in Storybook 12 -->
<script module>
  // Replace your-framework with the framework you are using, e.g. sveltekit or svelte-vite
  import { defineMeta } from '@storybook/your-framework';

  import YourComponent from './YourComponent.svelte';
  import MarginDecorator from './MarginDecorator.svelte';

  const { Story } = defineMeta({
    component: YourComponent,
    decorators: [
      (story, { parameters }) => ({
        Component: MarginDecorator,
        // 👇 Pass props to the MarginDecorator component
        props: { size: parameters.smallMargin ? 'small' : 'medium' },
      })
    ],
  });
</script>
```

```svelte filename="YourComponent.stories.svelte" renderer="svelte" language="ts" tabTitle="Svelte CSF 4"
<script module lang="ts">
  import preview from '../.storybook/preview';

  import YourComponent from './YourComponent.svelte';
  import MarginDecorator from './MarginDecorator.svelte';

  const { Story } = preview.meta({
    component: YourComponent,
    decorators: [
      (story, { parameters }) => ({
        Component: MarginDecorator,
        // 👇 Pass props to the MarginDecorator component
        props: { size: parameters.smallMargin ? 'small' : 'medium' },
      })
    ],
  });
</script>
```

```svelte filename="YourComponent.stories.svelte" renderer="svelte" language="ts" tabTitle="Svelte CSF 3"
<!-- ⚠️ CSF 3 is deprecated and will be removed in Storybook 12 -->
<script module>
  // Replace your-framework with the framework you are using, e.g. sveltekit or svelte-vite
  import { defineMeta } from '@storybook/your-framework';

  import YourComponent from './YourComponent.svelte';
  import MarginDecorator from './MarginDecorator.svelte';

  const { Story } = defineMeta({
    component: YourComponent,
    decorators: [
      (story, { parameters }) => ({
        Component: MarginDecorator,
        // 👇 Pass props to the MarginDecorator component
        props: { size: parameters.smallMargin ? 'small' : 'medium' },
      })
    ],
  });
</script>
```
