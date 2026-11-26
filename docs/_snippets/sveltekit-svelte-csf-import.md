```svelte filename="Button.stories.svelte" renderer="svelte" language="js"
<script module>
  // import { defineMeta } from '@storybook/addon-svelte-csf'; 👈 Remove this
  import { defineMeta } from '@storybook/sveltekit'; // 👈 Add this
</script>
```

```svelte filename="Button.stories.svelte" renderer="svelte" language="ts"
<script module lang="ts">
  // import { defineMeta } from '@storybook/addon-svelte-csf'; 👈 Remove this
  import { defineMeta } from '@storybook/sveltekit'; // 👈 Add this
</script>
```
