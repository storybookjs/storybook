<script module lang="ts">
  import { defineMeta } from '@storybook/svelte';
  import Button from './Button.svelte';
  import Icon from './Icon.svelte';
  const children = { Icon };
  const { Story } = defineMeta({ component: Button, subcomponents: children });
</script>

<Story name="Primary" />
