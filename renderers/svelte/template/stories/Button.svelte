<script>
  import { createEventDispatcher } from 'svelte';
  /**
   * Is this the principal call to action on the page?
   */
  export let primary = false;

  /**
   * What background color to use
   */
  export let backgroundColor = undefined;

  /**
   * How large should the button be?
   */
  export let size = 'medium';

  /**
   * Button contents
   */
  export let label = '';

  $: mode = primary ? 'storybook-button--primary' : 'storybook-button--secondary';

  $: style = backgroundColor ? `background-color: ${backgroundColor}` : '';

  const dispatch = createEventDispatcher();

  /**
   * Optional click handler
   */
  export let onClick = (event) => {
    dispatch('click', event);
  };
</script>

<button
  type="button"
  class={['storybook-button', `storybook-button--${size}`, mode].join(' ')}
  {style}
  on:click={onClick}
>
  {label}
</button>
