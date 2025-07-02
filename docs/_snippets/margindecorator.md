```svelte filename="MarginDecorator.svelte" renderer="svelte" language="js"
<script>
  let { children } = $props();
</script>

<div>
  {@render children()}
</div>

<style>
  div {
    margin: 3em;
  }
</style>
```

```svelte filename="MarginDecorator.svelte" renderer="svelte" language="ts"
<script>
  import type { Snippet } from 'svelte';

  let { children }: { children: Snippet } = $props();
</script>

<div>
  {@render children()}
</div>

<style>
  div {
    margin: 3em;
  }
</style>
```
