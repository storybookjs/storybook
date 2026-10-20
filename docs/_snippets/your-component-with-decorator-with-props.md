```svelte filename="YourComponent.stories.svelte" renderer="svelte" language="js" tabTitle="Svelte CSF"
<script module>
  import { defineMeta } from '@storybook/svelte-vite';

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

```svelte filename="YourComponent.stories.svelte" renderer="svelte" language="js" tabTitle="Svelte CSF Next 🧪"
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

```svelte filename="YourComponent.stories.svelte" renderer="svelte" language="ts" tabTitle="Svelte CSF"
<script module>
  import { defineMeta } from '@storybook/svelte-vite';

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

```svelte filename="YourComponent.stories.svelte" renderer="svelte" language="ts" tabTitle="Svelte CSF Next 🧪"
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
