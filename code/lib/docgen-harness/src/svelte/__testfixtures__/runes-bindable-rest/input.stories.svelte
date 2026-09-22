<script module lang="ts">
  import { defineMeta } from '@storybook/addon-svelte-csf';

  import BindableRest from './BindableRest.svelte';

  const { Story } = defineMeta({
    title: 'SvelteFixtures/BindableRest',
    component: BindableRest,
  });
</script>

<Story name="Default" args={{ value: 'Accepted', checked: true, disabled: true, placeholder: 'ignored' }} />
