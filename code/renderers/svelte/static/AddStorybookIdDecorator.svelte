<script>
  const { storyId, children } = $props();
</script>

<div data-story="true" id={storyId}>
  {@render children()}
</div>
