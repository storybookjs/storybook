```svelte filename="MyComponent.stories.svelte" renderer="svelte" language="js" tabTitle="Before"
<script>
  import { Meta, Template, Story } from '@storybook/addon-svelte-csf';

  import MyComponent from './MyComponent.svelte';
</script>

<Meta title="MyComponent" component={MyComponent} />

<Template let:args>
  <MyComponent {...args} />
</Template>

<Story name="Default" autodocs />
```

```svelte filename="MyComponent.stories.svelte" renderer="svelte" language="js" tabTitle="After"

<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf';

  import MyComponent from './MyComponent.svelte';

  const { Story } = defineMeta({
    component: MyComponent,
  });

</script>

<Story name="Default" tags={['autodocs']} />
```
