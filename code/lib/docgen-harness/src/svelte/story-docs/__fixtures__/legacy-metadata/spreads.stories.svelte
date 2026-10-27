<script module>
  import { defineMeta } from '@storybook/svelte';
  import Metadata from './Metadata.svelte';
  const { Story } = defineMeta({
    title: 'Spreads',
    component: Metadata,
    args: { label: 'From args', disabled: true },
  });
</script>

<Story name="Overrides">
  {#snippet template(args)}
    <Metadata {...args} label="Explicit" />
    <Metadata label="Earlier" {...args} />
  {/snippet}
</Story>
