<script lang="ts">
  import * as stylex from '@stylexjs/stylex';

  import { tokens } from '../tokens.stylex';

  const { label = 'Themed surface' }: { label?: string } = $props();

  const styles = stylex.create({
    surface: {
      backgroundColor: tokens.surface,
      color: tokens.text,
      padding: 24,
    },
    accent: {
      color: tokens.accent,
    },
  });
</script>

<div data-testid="surface" {...stylex.attrs(styles.surface)}>
  {label} <span {...stylex.attrs(styles.accent)}>with an accent</span>
</div>
