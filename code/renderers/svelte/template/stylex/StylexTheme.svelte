<script lang="ts">
  import * as stylex from '@stylexjs/stylex';
  import type { Snippet } from 'svelte';

  import { type ThemeName, themes } from './themes';

  const { theme, children }: { theme: ThemeName; children: Snippet } = $props();
</script>

<div {...stylex.attrs(themes[theme])}>
  {@render children()}
</div>
