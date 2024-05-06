<script context="module">
  import Button from './Button.svelte';

  export const meta = {
    title: 'MetaExport/WithoutDescr',
    component: Button,
  };
</script>

<script>
  import { Story, Template } from '../src/index.js';

  let count = $state(0);

  function handleClick() {
    count += 1;
  }
</script>

<Template let:args>
  <Button {...args} onclick={handleClick}>
    You clicked: {count}
  </Button>
</Template>

<Story name="Default" />

<!-- Story about the Rounded State -->
<Story name="Rounded" args={{ rounded: true }} />

<Story name="Square" source args={{ rounded: false }} />

<!-- Dynamic snippet should be disabled for this story -->
<Story name="Button No Args">
  <Button>Label</Button>
</Story>
