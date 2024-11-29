```svelte filename="MyComponent.stories.svelte" renderer="svelte" language="ts" tabTitle="Before"
<script>
  import { Meta, Story } from '@storybook/addon-svelte-csf';

  import MyComponent from './MyComponent.svelte';
</script>


<Meta title="MyComponent" component={MyComponent} />

<Story name="Default" />
```

```svelte filename="MyComponent.stories.svelte" renderer="svelte" language="ts" tabTitle="After"
<script context>
  import { defineMeta } from '@storybook/addon-svelte-csf';

  import MyComponent from './MyComponent.svelte';

  const { Story } = defineMeta({
    title: 'MyComponent',
    component: MyComponent,
  });
</script>

<Story name="Default" />
```
