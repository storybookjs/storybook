<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { HTMLButtonAttributes } from 'svelte/elements';

  interface Props extends HTMLButtonAttributes {
    primary?: boolean;
    children: Snippet;
  }

  const { primary = false, children, ...buttonProps }: Props = $props();
</script>

<button type="button" class:primary {...buttonProps}>
  {@render children()}
</button>
