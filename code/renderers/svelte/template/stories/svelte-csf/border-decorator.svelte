<script>
  let { children, color } = $props();
</script>

<div style:border-color={color}>
  {@render children()}
</div>

<style>
  div {
    border: 3px solid;
    padding: 1rem;
  }
</style>
