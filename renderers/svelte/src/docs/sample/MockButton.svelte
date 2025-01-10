<script>
  import { createEventDispatcher, afterUpdate } from 'svelte';
  export let text = '';
  export let rounded = true;

  const dispatch = createEventDispatcher();

  function onClick(event) {
    rounded = !rounded;

    /**
     * Click Event 
     */
    dispatch('click', event);
  }

  afterUpdate(() => {
    /**
     * After Update
     */
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

<svelte:options accessors={true} />
<button class="button" class:rounded on:click={onClick}>
  <strong>{rounded ? 'Round' : 'Square'} corners</strong>
  <br />
  {text}
  <!-- Default Slot -->
  <slot {rounded}/>
</button>
