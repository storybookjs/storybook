<script>
  let { children } = $props();
</script>
<div style="margin: 3em;" data-testid="local-decorator">
  {@render children?.()}
</div>