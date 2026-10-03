<script lang="ts">
  import Box from './components/Box.svelte';

  const { width, text }: { width?: number; text: string } = $props();
</script>

<Box {width}>{text}</Box>
