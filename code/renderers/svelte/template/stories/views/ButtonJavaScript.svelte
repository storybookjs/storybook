<script>
  /**
   * @component Button View
   * @wrapper
   */
  import { global as globalThis } from '@storybook/global';
  // @ts-ignore
  const Button = globalThis.Components?.Button;

  /**
   * Rounds the button
   */
  export let primary = false;

  /**
   * Displays the count
   */
  let count = 0;

  /**
   * Button text
   * @slot
   */
  export let text = 'You clicked';

  function handleClick(_event) {
    count += 1;
  }
</script>

<h1>Button view</h1>

<Button {primary} on:click on:click={handleClick} label="{text}: {count}" />

<p>A little text to show this is a view.</p>
<p>If we need to test components in a Svelte environment, for instance to test slot behaviour,</p>
<p>then wrapping the component up in a view</p>
<p>made just for the story is the simplest way to achieve this.</p>
