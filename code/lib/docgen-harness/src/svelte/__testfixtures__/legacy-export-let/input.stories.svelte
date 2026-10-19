<script module lang="ts">
  import { defineMeta } from '@storybook/svelte';

  import LegacyExportLet from './LegacyExportLet.svelte';

  const { Story } = defineMeta({
    title: 'SvelteFixtures/LegacyExportLet',
    component: LegacyExportLet,
  });
</script>

<Story name="Default" args={{ label: 'Legacy story', count: 4 }}>Child content</Story>
