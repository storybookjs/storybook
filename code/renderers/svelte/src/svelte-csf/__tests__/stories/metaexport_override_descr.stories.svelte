<script context="module">
  import Button from './Button.svelte';

  /**
   * This commentary should be ignored.
   */
  export const meta = {
    title: 'MetaExport/Override',
    component: Button,
    tags: ['autodocs'],
    parameters: {
      docs: {
        description: {
          // FIXME: Doesn't work
          component: 'Description set explicitly in the meta export',
        },
      },
    },
  };
</script>

<script>
  import { Story, Template } from '../src/index';

  let count = $state(0);

  function handleClick() {
    count += 1;
  }
</script>

<Template>
  {#snippet children(args)}
    <Button {...args} onclick={handleClick}>
      You clicked: {count}
    </Button>
  {/snippet}
</Template>

<Story name="Default" />

<!-- Story about the Rounded State -->
<Story name="Rounded" args={{ rounded: true }} />

<Story name="Square" source args={{ rounded: false }} />

<!-- Dynamic snippet should be disabled for this story -->
<Story name="Button No Args">
  <Button>Label</Button>
</Story>

