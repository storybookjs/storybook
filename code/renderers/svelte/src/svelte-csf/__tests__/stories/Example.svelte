<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { HTMLButtonAttributes } from 'svelte/elements';

  type Props = {
    rounded?: boolean;
    children?: Snippet;
  } & Pick<HTMLButtonAttributes, 'onclick' | 'onmouseenter' | 'onmouseleave'>;

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
