<script lang="ts" module>
  import { defineMeta } from '@storybook/svelte';
  import type { ComponentProps } from 'svelte';

  import { Parts } from './subcomponent-barrel';

  // The component and its subcomponent come from a barrel's `export * as`, for the docgen
  // baselines.
  const { Story } = defineMeta({
    component: Parts.Layout,
    subcomponents: { Button: Parts.Button },
    tags: ['!dev'],
    parameters: {
      chromatic: { disableSnapshot: true },
    },
  });

  type Args = ComponentProps<typeof Parts.Layout>;
</script>

{#snippet template(args: Args)}
  <div>{args.mainFontSize}</div>
{/snippet}

<Story name="Subcomponents from a barrel namespace" {template} />
