<script lang="ts" module>
  import { defineMeta } from '@storybook/svelte';
  import type { ComponentProps } from 'svelte';

  import Button from '../button.svelte';
  import Layout from '../layout.svelte';

  const { Story } = defineMeta({
    component: Layout,
    subcomponents: {
      Layout,
      Button,
    },
    tags: ['!dev'],
    parameters: {
      chromatic: { disableSnapshot: true },
    },
  });

  type Args = ComponentProps<typeof Layout>;
</script>

{#snippet template(args: Args)}
  <div>{args.mainFontSize}</div>
{/snippet}

<Story name="Subcomponents keep the main component args" {template} />
