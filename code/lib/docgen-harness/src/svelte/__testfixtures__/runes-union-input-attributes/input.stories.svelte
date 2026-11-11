<script module lang="ts">
  import { defineMeta } from '@storybook/svelte';

  import FileOrTextInput from './FileOrTextInput.svelte';

  const { Story } = defineMeta({
    title: 'SvelteFixtures/FileOrTextInput',
    component: FileOrTextInput,
  });
</script>

<Story name="Default" args={{ type: 'text', placeholder: 'Name' }} />
