<script lang="ts">
  import type { HTMLButtonAttributes } from 'svelte/elements';

  interface $$Props extends Partial<HTMLButtonAttributes> {
    rounded?: boolean;
  }

  export let rounded = false;
</script>

<button class="button" class:rounded {...$$restProps}>
  <strong>{rounded ? 'Round' : 'Square'} corners</strong>
  <hr />
</button>

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
