<script module lang="ts">
  import { defineMeta } from '@storybook/addon-svelte-csf';
  import { fn } from 'storybook/test';

  import RadioGroup from './RadioGroup.svelte';

  const { Story } = defineMeta({
    title: 'SvelteFixtures/RadioGroup',
    component: RadioGroup,
  });
</script>

<Story
  name="Default"
  args={{
    label: 'Choice',
    onchange: fn(),
    values: [
      ['a', 'Alpha'],
      ['b', 'Beta', 'icon'],
    ],
    value: 'a',
  }}
/>
