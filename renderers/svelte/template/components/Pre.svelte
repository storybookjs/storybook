<script>
  /**
   * Styles to use for this component
   */
  export let style = {};
  /**
   * Object to log
   */
  export let object;
  /**
   * Text content to log
   */
  export let text = '';

  $: finalText = object ? JSON.stringify(object, null, 2) : text;
</script>

<pre data-testid="pre" {style}>{finalText}</pre>
