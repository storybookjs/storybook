<script lang="ts">
  import type { Snippet } from "svelte";
  import type { HTMLAttributes } from "svelte/elements";

interface Props extends HTMLAttributes<HTMLButtonElement> {
    children?: Snippet,
    rounded?: boolean,
    // FIXME: What's that for again?
    onafterupdate?: () => void,
    text?: string,
}

  let { children, rounded = true, onafterupdate, text = "", ...restProps }: Props = $props();

  // FIXME: What's that for again?
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

<button class="button" class:rounded={rounded} {...restProps}>
  <strong>{rounded ? 'Round' : 'Square'} corners</strong>
  <br />
  {text}
  {#if children}
    {@render children()}
  {/if}
</button>
