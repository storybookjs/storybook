<script module>
  import { defineMeta } from '@storybook/svelte';
  import Button from './Button.svelte';
  import Other from './Other.svelte';
  const { Story } = defineMeta({ component: Button, subcomponents: { Other } });
</script>

<Story name="Primary" />
