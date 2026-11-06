```ts filename="Button.stories.js|ts" renderer="common" language="ts"
// ...from above
const meta = preview.meta({
  //...
});

export const Primary = meta.story({
  args: {
    primary: true,
  },
});
```

```svelte filename="Button.stories.svelte" renderer="svelte" language="ts"
<script module lang="ts">
  import preview from '../.storybook/preview';

  import Button from './Button.svelte';

  const { Story } = preview.meta({
    component: Button,
    parameters: {
      // type-safe!
      layout: 'centered',
    },
  });
</script>

<Story name="Primary" args={{ primary: true, children: 'Button' }} />
```
