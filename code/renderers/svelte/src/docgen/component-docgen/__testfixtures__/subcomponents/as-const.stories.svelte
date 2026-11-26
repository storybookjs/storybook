<script module lang="ts">
  import { defineMeta } from '@storybook/svelte';
  import Button from './Button.svelte';
  import Icon from './Icon.svelte';
  const { Story } = defineMeta({ component: Button, subcomponents: { Icon } as const });
</script>

<Story name="Primary" />
