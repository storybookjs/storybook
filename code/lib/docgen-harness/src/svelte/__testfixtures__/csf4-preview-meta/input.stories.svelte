<script module lang="ts">
  import preview from './preview.ts';
  import Tag from './Tag.svelte';

  /** CSF4 tag meta description. */
  const { Story } = preview.meta({
    title: 'SvelteFixtures/Csf4Tag',
    component: Tag,
    args: { label: 'Meta label' },
  });
</script>

<!-- Inherits the meta args. -->
<Story name="Default" />

<Story name="Success" args={{ tone: 'success', removable: true }} />

<Story name="With Template" exportName="WithTemplate" args={{ label: 'Template label' }}>
  {#snippet template(args)}
    <Tag {...args} tone="danger" />
  {/snippet}
</Story>
