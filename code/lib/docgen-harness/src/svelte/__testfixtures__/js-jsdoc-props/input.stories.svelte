<script module>
  import { defineMeta } from '@storybook/svelte';

  import JsJsdocProps from './JsJsdocProps.svelte';

  const { Story } = defineMeta({
    title: 'SvelteFixtures/JsJsdocProps',
    component: JsJsdocProps,
  });
</script>

<Story name="Default" args={{ label: 'JS props', count: 2 }} />
