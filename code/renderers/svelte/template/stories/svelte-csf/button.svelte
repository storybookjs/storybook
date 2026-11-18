<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { HTMLButtonAttributes } from 'svelte/elements';

  interface Props extends HTMLButtonAttributes {
    /**
     * Is this the principal call to action on the page?
     */
    primary?: boolean;
    /**
     * What background color to use
     */
    backgroundColor?: string;
    /**
     * How large should the button be?
     */
    size?: 'small' | 'medium' | 'large';

    /**
     * Content of the button
     */
    children: Snippet;
  }

  const {
    primary = false,
    backgroundColor,
    size = 'medium',
    children,
    ...buttonProps
  }: Props = $props();
</script>

<button
  type="button"
  class:primary
  class={size}
  style={backgroundColor ? `background-color: ${backgroundColor}` : ''}
  {...buttonProps}
>
  {@render children()}
</button>

<style>
  button {
    font-family: 'Nunito Sans', 'Helvetica Neue', Helvetica, Arial, sans-serif;
    font-weight: 700;
    border: 0;
    border-radius: 3em;
    cursor: pointer;
    display: inline-block;
    line-height: 1;

    color: #333;
    background-color: transparent;
    box-shadow: rgba(0, 0, 0, 0.15) 0px 0px 0px 1px inset;
  }

  .primary {
    color: white;
    background-color: #1ea7fd;
    box-shadow: unset;
  }

  .small {
    font-size: 12px;
    padding: 10px 16px;
  }

  .medium {
    font-size: 14px;
    padding: 11px 20px;
  }
  .large {
    font-size: 16px;
    padding: 12px 24px;
  }
</style>
