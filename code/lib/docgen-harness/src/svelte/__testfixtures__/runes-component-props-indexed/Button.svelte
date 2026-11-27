<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    /** Button variant. */
    variant?: 'primary' | 'secondary';
    /** Button content. */
    children?: Snippet;
  }

  let { variant = 'primary', children }: Props = $props();
</script>

<button type="button" data-variant={variant}>
  {@render children?.()}
</button>
