<script context="module" lang="ts">
  import { defineMeta } from '@storybook/addon-svelte-csf';

  import RequiredSnippet from './RequiredSnippet.svelte';

  const { Story } = defineMeta({
    title: 'Testing/RequiredSnippet',
    component: RequiredSnippet,
    tags: ['autodocs'],
  });
</script>

<!-- FIXME: Should it throw at runtime, because we don't provide any snippet - attribute (prop) 'children'? -->
<Story name="Case 1" />

{#snippet children()}
  <p>This works</p>
{/snippet}

<!-- Works, as expected -->
<Story name="Case 2" args={{ children }} />

<Story name="Case 3">
  {#snippet children()}
    <p>This works</p>
  {/snippet}
</Story>

<Story name="Case 4">
  <p>This works</p>
</Story>
