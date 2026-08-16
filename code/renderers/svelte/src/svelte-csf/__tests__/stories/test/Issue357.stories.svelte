<script lang="ts" module>
  import { defineMeta } from '@storybook/addon-svelte-csf';
  import type { ComponentProps } from 'svelte';

  import Button from '../../../examples/components/Button.svelte';
  import Layout from '../../../examples/components/Layout.svelte';

  const { Story } = defineMeta({
    title: 'Test/Issue 357',
    component: Layout,
    subcomponents: {
      Layout,
      Button,
    },
    tags: ['!dev'],
  });

  type Args = ComponentProps<typeof Layout>;
</script>

{#snippet template(args: Args)}
  <div>{args.mainFontSize}</div>
{/snippet}

<Story name="Subcomponents keep the main component args" {template} />
