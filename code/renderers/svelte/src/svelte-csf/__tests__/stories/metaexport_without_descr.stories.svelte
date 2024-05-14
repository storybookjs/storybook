<script context="module">
  import Button from './Button.svelte';

  /** @type {import('@storybook/svelte').Meta<Button>} */
  export const meta = {
    title: 'MetaExport/WithoutDescr',
    component: Button,
  };
</script>

<script>
  import { Story, Template } from '../src/index';

  let count = $state(0);

  function handleClick() {
    count += 1;
  }
</script>

<Template {meta}>
  {#snippet children(args)}
    <Button {...args} onclick={handleClick}>
      You clicked: {count}
    </Button>
  {/snippet}
</Template>

<Story name="Default" />

<!-- Story about the Rounded State -->
<Story {meta} name="Rounded" args={{ rounded: true }} />

<Story {meta} name="Square" source args={{ rounded: false }} />

<!-- Dynamic snippet should be disabled for this story -->
<Story {meta} name="Button No Args">
  <Button>Label</Button>
</Story>
