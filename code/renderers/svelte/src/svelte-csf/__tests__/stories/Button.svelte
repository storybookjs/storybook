<script>
  let { children, text = '', rounded = true, onclick, onafterupdate } = $props();

  function onClick(event) {
    rounded = !rounded;
    onclick?.(event);
  }

  $effect(() => {
    onafterupdate?.();
  });
</script>

<style>
  .rounded {
    border-radius: 35px;
  }

  .button {
    border: 3px solid;
    padding: 10px 20px;
    background-color: white;
    outline: none;
  }
</style>

<button class="button" class:rounded onclick={onClick}>
  <strong>{rounded ? 'Round' : 'Square'} corners</strong>
  <br />
  {text}
  {@render children?.()}
</button>
