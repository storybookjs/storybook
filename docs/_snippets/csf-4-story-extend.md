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

export const PrimaryDisabled = Primary.extend({
  args: {
    disabled: true,
  },
});
```

```svelte filename="Button.stories.svelte" renderer="svelte" language="ts"
<script module lang="ts">
  import preview from '../.storybook/preview';

  import Button from './Button.svelte';

  const { Story } = preview.meta({ component: Button });
</script>

<Story name="Primary" args={{ primary: true }}>Click me</Story>

<!-- 👇 Renders "Click me", with the args { primary: true, size: 'small' } -->
<Story extend="Primary" name="Primary Small" args={{ size: 'small' }} />
```
