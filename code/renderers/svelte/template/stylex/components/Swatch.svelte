<script lang="ts">
  import * as stylex from '@stylexjs/stylex';
  import { brand } from 'stylex-tokens-fixture/tokens.stylex.js';

  import { tokens } from '../tokens.stylex';

  const { source }: { source: 'local' | 'package' } = $props();

  const styles = stylex.create({
    swatch: {
      fontWeight: 'bold',
      padding: 8,
    },
    local: {
      color: tokens.accent,
    },
    package: {
      color: brand.accent,
    },
  });
</script>

<p data-testid="swatch" {...stylex.attrs(styles.swatch, styles[source])}>
  {source === 'local' ? 'Local token' : 'Package token'}
</p>
