<script module lang="ts">
  import { defineMeta } from '@storybook/addon-svelte-csf';

  import UnionLiteral from './UnionLiteral.svelte';

  const { Story } = defineMeta({
    title: 'SvelteFixtures/UnionLiteral',
    component: UnionLiteral,
  });
</script>

<Story name="Default" args={{ level: 1, tone: null, mode: 'auto' }} />

<Story name="Large" args={{ size: 'large', tone: 'warn', level: 3, mode: false }} />
