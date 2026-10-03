<script lang="ts">
  import type { Snippet } from 'svelte';

  const { children }: { children: Snippet } = $props();
</script>

<div class="unlayered-reset">
  <svelte:element this={'style'}>{'.unlayered-reset div { color: blue; padding: 0; }'}</svelte:element>
  {@render children()}
</div>
