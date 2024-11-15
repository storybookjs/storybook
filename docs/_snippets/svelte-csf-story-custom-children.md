```svelte filename="MyComponent.stories.svelte" renderer="svelte" language="js" tabTitle="Before"
<script>
  import { Meta, Template, Story } from '@storybook/addon-svelte-csf';

  import OuterComponent from './OuterComponent.svelte';
  import MyComponent from './MyComponent.svelte';
</script>

<Meta title="MyComponent" component={MyComponent} />

<Template let:args>
  <OuterComponent>
    <MyComponent />
  </OuterComponent>
</Template>

<Story name="Default" />
```

```svelte filename="MyComponent.stories.svelte" renderer="svelte" language="js" tabTitle="After"

<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf';

  import OuterComponent from './OuterComponent.svelte';
  import MyComponent from './MyComponent.svelte';

  const { Story } = defineMeta({
    component: MyComponent,
  });

</script>

<Story name="Default">
  <OuterComponent>
    <MyComponent />
  </OuterComponent>
</Story>
```
