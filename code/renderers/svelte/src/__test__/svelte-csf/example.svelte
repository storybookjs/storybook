<script lang="ts">
  import type { HTMLButtonAttributes } from 'svelte/elements';

  interface Props extends HTMLButtonAttributes {
    rounded?: boolean;
  }

  let { children, rounded = true, ...restProps }: Props = $props();
</script>

<button class="button" class:rounded {...restProps}>
  <strong>{rounded ? 'Round' : 'Square'} corners</strong>
  <hr />
  {#if children}
    {@render children()}
  {/if}
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
