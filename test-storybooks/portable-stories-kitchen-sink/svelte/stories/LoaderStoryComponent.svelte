<script>
  const { mockFn, loaded } = $props();
  
  let data = $state();
  
  $effect(() => {
    if (mockFn && loaded) {
      data = mockFn('render');
    }
  });
</script>

<div>
  <div data-testid="loaded-data">{loaded.value}</div>
  <div data-testid="spy-data">{String(data)}</div>
</div>