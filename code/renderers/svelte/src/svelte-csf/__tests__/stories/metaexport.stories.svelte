<script context='module'>
  import Button from './Button.svelte';

  /**
   * Stories about a Button.
   * 
   * This description is set as a commentary on the meta export.
   */
  export const meta = {
    title: 'MetaExport/MetaExport',
    component: Button,
    tags: ['autodocs']
  }
</script>

<script>
  import { Story, Template } from '../src/index';

  let count = 0;
  function handleClick() {
    count += 1;
  }
</script>

<Template let:args>
  <Button {...args} on:click={handleClick}>
    You clicked: {count}
  </Button>
</Template>

<Story name="Default"/>

<!-- Story about the Rounded State -->
<Story name="Rounded" args={{rounded: true}}/>

<Story name="Square" source args={{rounded: false}}/>

<!-- Dynamic snippet should be disabled for this story -->
<Story name="Button No Args">
  <Button>Label</Button>
</Story>