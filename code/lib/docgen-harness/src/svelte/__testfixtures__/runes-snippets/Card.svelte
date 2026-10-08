<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    /** Default body content. */
    children?: Snippet;
    /** Header content. */
    header?: Snippet<[title: string]>;
    /** Footer content. */
    footer: Snippet;
    /** Card title. */
    title?: string;
  }

  let { children, header, footer, title = 'Card' }: Props = $props();
</script>

<article>
  {@render header?.(title)}
  {@render children?.()}
  {@render footer()}
</article>
