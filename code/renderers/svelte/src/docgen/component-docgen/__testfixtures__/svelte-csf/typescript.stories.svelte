<script module lang="ts">
  import { defineMeta } from '@storybook/svelte';
  import Button from './Button.svelte';
  import Other from './Other.svelte';
  const { Story } = defineMeta({
    component: Button as any,
    subcomponents: { Other },
  } satisfies object);
</script>

<Story name="Primary" />
