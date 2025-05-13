<script>
  const { color = 'violet', children } = $props();
</script>

<div style="border: 3px solid {color}; padding: 10px; margin: 10px;">
  {@render children()}
</div>
