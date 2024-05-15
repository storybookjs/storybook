<script lang="ts">
  import type { Snippet } from "svelte";
  import type { HTMLAttributes } from "svelte/elements";

  interface Props extends HTMLAttributes<HTMLButtonElement> {
      children?: Snippet,
      rounded?: boolean,
  }

  let { children, rounded = true, ...restProps }: Props = $props();
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

<button class="button" class:rounded={rounded} {...restProps}>
  <strong>{rounded ? 'Round' : 'Square'} corners</strong>
  <hr>
  {#if children}
    {@render children()}
  {/if}
</button>
