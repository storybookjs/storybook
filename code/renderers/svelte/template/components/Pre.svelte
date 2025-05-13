<script>
  const { style = {}, object, text = '' } = $props();

  let finalText = $derived(object ? JSON.stringify(object, null, 2) : text);
</script>

<pre data-testid="pre" {style}>{finalText}</pre>
