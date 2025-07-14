<script>
  const { content } = $props();

  const contentValue = $derived(typeof content === 'function' ? content() : content);
</script>

<div>{@html contentValue}</div>
