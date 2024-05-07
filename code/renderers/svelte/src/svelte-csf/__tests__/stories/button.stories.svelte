<script context="module" lang="ts">
  import type { Meta } from '@storybook/svelte';

  export const meta = {
    title: 'Button',
    component: Button,
    tags: ['autodocs'],
    parameters: {
      docs: {
        description: {
          component: 'Description set explicitly in the meta export',
        },
      },
    },
  } satisfies Meta<Button>;
</script>

<script>
  import { Story, Template } from '../src/index.js';

  import Button from './Button.svelte';

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

<Story name="Rounded" args={{ rounded: true }} />

<Story name="Square" source args={{ rounded: false }} />

<!-- Dynamic snippet should be disabled for this story -->
<Story name="Button No Args">
  <Button>Label</Button>
</Story>
