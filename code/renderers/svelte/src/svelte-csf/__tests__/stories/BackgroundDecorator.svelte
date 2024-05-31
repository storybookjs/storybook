<script>
let {children,color} = $props();
</script>

<div style:background-color={color}>
  {@render children()}
</div>
