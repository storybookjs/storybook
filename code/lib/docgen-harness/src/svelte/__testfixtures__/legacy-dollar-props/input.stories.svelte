<script module lang="ts">
  import { defineMeta } from '@storybook/svelte';

  import LeoButton from './LeoButton.svelte';

  const { Story } = defineMeta({
    title: 'SvelteFixtures/LeoButton',
    component: LeoButton,
  });
</script>

<Story
  name="Default"
  args={{ kind: 'outline', size: 'large', disabled: true, type: 'button' }}
>
  Press
</Story>
