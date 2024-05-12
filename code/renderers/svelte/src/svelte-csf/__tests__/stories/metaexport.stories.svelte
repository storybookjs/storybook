<script context="module" lang="ts">
  import type {Meta} from '@storybook/svelte';

  import Button from './Button.svelte';

  /**
   * Stories about a Button.
   *
   * This description is set as a commentary on the meta export.
   */
  export const meta = {
    title: 'MetaExport/MetaExport',
    component: Button,
    tags: ['autodocs'],
  } satisfies Meta<Button>;
</script>

<script lang="ts">
  import { Story, Template } from '../src/index.js';

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
