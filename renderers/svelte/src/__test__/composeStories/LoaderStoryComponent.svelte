<script lang="ts">
  let {
    mockFn,
    loaded,
  }: {
    mockFn: (arg: string) => string;
    loaded: { value: string };
  } = $props();

  let data = $derived(mockFn && loaded && mockFn('render'));
</script>

<div>
  <div data-testid="loaded-data">{loaded.value}</div>
  <div data-testid="spy-data">{String(data)}</div>
</div>
