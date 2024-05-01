<script>
  import { Meta, Story, Template } from '../src/index';

  import Button from './Button.svelte';

  let count = $state(0);
  function handleClick() {
    count += 1;
  }
</script>

<!-- Stories about a Button -->
<Meta component={Button} autodocs/>

<Template let:args>
  <Button {...args} onclick={handleClick}>
    You clicked: {count}
  </Button>
</Template>

<Story name="Default"/>

<Story name="Rounded" args={{rounded: true}}/>

<Story name="Square" source args={{rounded: false}}/>

<!-- Dynamic snippet should be disabled for this story -->
<Story name="Button No Args">
  <Button>Label</Button>
</Story>