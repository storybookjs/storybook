<script context="module" lang="ts">
  import { defineMeta } from '@storybook/addon-svelte-csf';

  import RequiredSnippet from './RequiredSnippet.svelte';

  const { Story } = defineMeta({
    component: RequiredSnippet,
    tags: ['autodocs'],
  });
</script>


<!-- Not working, as expected -->
<!-- <Story name="Case 1" /> -->

{#snippet children()}
<p>This works</p>
{/snippet}

<!-- Works, as expected TODO: does not actually work, renders nothing-->
<Story name="Case 2" args={{ children }} />

<!-- Works, as expected, but TypeScript is not happy -->
<!-- Current workaround: add `args: { children: "" }` to `defineMeta`, but this is invalid, Svelte snippets cannot be literal, they're functions --> 
<Story name="Case 3">
  {#snippet children()}
    <p>This works</p>
  {/snippet}
</Story>
