<script lang="ts">
  import type { Snippet } from "svelte";

  interface Props {
    children: Snippet;
    decoratorArg: string;
  }
  let { children, decoratorArg }: Props = $props();
</script>

<div>
  Decorator: {decoratorArg}
  {@render children()}
</div>
