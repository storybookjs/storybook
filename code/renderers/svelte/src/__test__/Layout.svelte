<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    title: string;
    children: Snippet;
    footer?: Snippet<[year: number]>;
  }
  let { title, children, footer }: Props = $props();
</script>

<h1>{title}</h1>
{@render children()}
{@render footer?.(2026)}
