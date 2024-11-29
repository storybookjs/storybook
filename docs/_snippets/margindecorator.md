```svelte filename="MarginDecorator.svelte" renderer="svelte" language="js" tabTitle="Svelte 4"
<div>
  <slot />
</div>

<style>
  div {
    margin: 3em;
  }
</style>
```

```svelte filename="MarginDecorator.svelte" renderer="svelte" language="js" tabTitle="Svelte 5"
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

```svelte filename="MarginDecorator.svelte" renderer="svelte" language="ts" tabTitle="Svelte 4"
<div>
  <slot />
</div>

<style>
  div {
    margin: 3em;
  }
</style>
```

```svelte filename="MarginDecorator.svelte" renderer="svelte" language="ts" tabTitle="Svelte 5"
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
