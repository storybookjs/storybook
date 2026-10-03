<script lang="ts">
  import * as stylex from '@stylexjs/stylex';
  import type { Snippet } from 'svelte';

  const { width, children }: { width?: number; children?: Snippet } = $props();

  const styles = stylex.create({
    box: {
      backgroundColor: '#eff6ff',
      borderRadius: 8,
      color: '#1d4ed8',
      padding: 16,
    },
    width: (width: number) => ({ width }),
  });
</script>

<div data-testid="box" {...stylex.attrs(styles.box, width !== undefined && styles.width(width))}>
  {@render children?.()}
</div>
