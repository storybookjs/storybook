<script>
  import { createEventDispatcher, afterUpdate } from 'svelte';
  export let text = '';
  export let rounded = true;

  const dispatch = createEventDispatcher();

  function onClick(event) {
    rounded = !rounded;

    dispatch('click', event);
  }

  afterUpdate(() => {
    dispatch('afterUpdate');
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

<button class="button" class:rounded on:click={onClick}>
  <strong>{rounded ? 'Round' : 'Square'} corners</strong>
  <br />
  {text}
  <slot />
</button>
