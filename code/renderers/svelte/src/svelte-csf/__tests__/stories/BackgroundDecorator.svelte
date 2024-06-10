<script>
  let { children, color, width } = $props();
</script>

<div style:background-color={color} style:width>
  {@render children()}
</div>
