<script module lang="ts">
  import { defineMeta } from '@storybook/addon-svelte-csf';

  import ComplexTypes from './ComplexTypes.svelte';

  const { Story } = defineMeta({
    title: 'SvelteFixtures/ComplexTypes',
    component: ComplexTypes,
  });
</script>

<Story name="Default" args={{ config: { id: 'panel', open: true }, items: ['a', 'b'], lookup: { a: 1 }, pair: [1, 2], state: { open: false }, when: new Date('2020-01-01T00:00:00.000Z') }} />
