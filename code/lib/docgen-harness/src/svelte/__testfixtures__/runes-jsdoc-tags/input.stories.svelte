<script module lang="ts">
  import { defineMeta } from '@storybook/addon-svelte-csf';

  import JsdocTags from './JsdocTags.svelte';

  const { Story } = defineMeta({
    title: 'SvelteFixtures/JsdocTags',
    component: JsdocTags,
  });
</script>

<Story name="Default" args={{ oldLabel: 'Old', label: 'New', example: 'Example', internalValue: 'Internal' }} />
