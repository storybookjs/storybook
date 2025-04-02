<script>
  /**
   * @typedef {Object} Props
   * @property {boolean} [primary] Is this the principal call to action on the page?
   * @property {string} [backgroundColor] What background color to use
   * @property {'small' | 'medium' | 'large'} [size] How large should the button be?
   * @property {string} label Button contents
   * @property {() => void} [onClick] The onclick event handler
   */

  /** @type {Props} */
  const { primary = false, backgroundColor, size = 'medium', label, onClick } = $props();

  let mode = $derived(primary ? 'storybook-button--primary' : 'storybook-button--secondary');
  let style = $derived(backgroundColor ? `background-color: ${backgroundColor}` : '');
</script>

<button
  type="button"
  class={['storybook-button', `storybook-button--${size}`, mode].join(' ')}
  {style}
  onclick={onClick}
>
  {label}
</button>

<style>
  .storybook-button {
    display: inline-block;
    cursor: pointer;
    border: 0;
    border-radius: 3em;
    font-weight: 700;
    line-height: 1;
    font-family: 'Nunito Sans', 'Helvetica Neue', Helvetica, Arial, sans-serif;
  }
  .storybook-button--primary {
    background-color: #555ab9;
    color: white;
  }
  .storybook-button--secondary {
    box-shadow: rgba(0, 0, 0, 0.15) 0px 0px 0px 1px inset;
    background-color: transparent;
    color: #333;
  }
  .storybook-button--small {
    padding: 10px 16px;
    font-size: 12px;
  }
  .storybook-button--medium {
    padding: 11px 20px;
    font-size: 14px;
  }
  .storybook-button--large {
    padding: 12px 24px;
    font-size: 16px;
  }
</style>
