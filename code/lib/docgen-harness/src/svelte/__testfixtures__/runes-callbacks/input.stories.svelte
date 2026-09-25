<script module lang="ts">
  import { defineMeta } from '@storybook/addon-svelte-csf';
  import { fn } from 'storybook/test';

  import Callbacks from './Callbacks.svelte';

  const { Story } = defineMeta({
    title: 'SvelteFixtures/Callbacks',
    component: Callbacks,
  });
</script>

<Story name="Default" args={{ onclick: fn(), onchange: fn(), format: (n: number) => `#${n}` }} />
