<script module lang="ts">
  import { defineMeta } from '@storybook/svelte';

  import Checkbox from './Checkbox.svelte';

  const { Story } = defineMeta({
    title: 'SvelteFixtures/Checkbox',
    component: Checkbox,
  });
</script>

<Story name="Default" args={{ checked: true, disabled: true }} />
