<script module>
  import { defineMeta } from '@storybook/svelte';
  import Metadata from './Metadata.svelte';
  const { Story } = defineMeta({ title: 'Unsafe strings', component: Metadata });
</script>

<script>
  let files = [];
</script>

<Story name="Markup" args={{ label: '<span title="quoted">{content}</span> & end' }} />
<Story name="Multiline" args={{ label: `First line
Second line` }} />
<Story name="Binding" args={{ files: ['example.png'] }}>
  {#snippet template(args)}
    <Metadata bind:files {...args} />
  {/snippet}
</Story>
