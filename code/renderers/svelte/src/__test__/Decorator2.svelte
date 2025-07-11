<script lang="ts">
  import type { Snippet } from "svelte";

  interface Props {
    children: Snippet;
    decoratorArg2: string;
  }
  let { children, decoratorArg2 }: Props = $props();
</script>

<div>
  Decorator: {decoratorArg2}
  {@render children()}
</div>
