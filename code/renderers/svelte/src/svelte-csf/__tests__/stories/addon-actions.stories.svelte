<script>
  import { Meta, Story } from '../src/index.js';
  import { action } from '@storybook/addon-actions';

  import Button from './Button.svelte';
</script>

<Meta title="Addon/Actions" component={Button}/>

<Story name="Action on component method">
  <Button text="Custom text" on:click={action('I am logging in the actions tab')}/>
</Story>

