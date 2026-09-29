<script lang="ts">
  import type { HTMLAttributes } from 'svelte/elements';

  interface Props extends HTMLAttributes<HTMLButtonElement> {
    rounded?: boolean;
  }

  let { rounded = false, ...restProps }: Props = $props();
</script>

<button class="button" class:rounded {...restProps}>
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
