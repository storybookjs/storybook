<script context="module" lang="ts">
  import { defineMeta } from '@storybook/addon-svelte-csf';

  import RequiredSnippet from './RequiredSnippet.svelte';

  const { Story } = defineMeta({
    title: 'Testing/RequiredSnippet',
    component: RequiredSnippet,
    tags: ['autodocs'],
  });
</script>

<!-- Not working, as expected, because the `children` snippet is required. -->
<!-- <Story name="Case 1" /> -->

{#snippet children()}
  <p>This works</p>
{/snippet}

<!-- Works, as expected -->
<Story name="Case 2" args={{ children }} />

<!--
FIXME:
Works, but TypeScript is not happy.
Current workaround: add `args: { children: "" }` to `defineMeta`, but this is invalid, Svelte snippets cannot be literal, they're functions
Reference: https://github.com/storybookjs/addon-svelte-csf/pull/181#issuecomment-2130744977
-->
<Story name="Case 3">
  {#snippet children()}
    <p>This works</p>
  {/snippet}
</Story>

<!--
FIXME: Same issue as above.
This is equivalent to the case above, a shorter syntax.
-->
<Story name="Case 4">
  <p>This works</p>
</Story>
