<script module lang="ts">
  import { defineMeta } from '@storybook/svelte';
  import Button from './Button.svelte';
  import Other from './Other.svelte';
  const { Story } = defineMeta({
    component: Button<{ id: number }>,
    subcomponents: { Other },
  });
</script>

<Story name="Primary" />
