<script lang="ts">
  let { children, rounded = true, onclick, onafterupdate, text = "" }: {
    children?: () => any,
    rounded?: boolean,
    onclick: (event: Event) => void,
    onafterupdate?: () => void,
    text: string,
  } = $props();


  function onClick(event) {
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

<button class="button" class:rounded={rounded} onclick={onClick}>
  <strong>{rounded ? 'Round' : 'Square'} corners</strong>
  <br />
  {text}
  {@render children?.()}
</button>
