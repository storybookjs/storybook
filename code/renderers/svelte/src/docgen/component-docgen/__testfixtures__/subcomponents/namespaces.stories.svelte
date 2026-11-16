<script module>
  import { defineMeta } from '@storybook/svelte';
  import Button from './Button.svelte';
  import { Kit } from './kit';
  import * as Parts from './parts';
  const { Story } = defineMeta({
    component: Button,
    subcomponents: { Barrel: Kit.Icon, Namespace: Parts.Icon },
  });
</script>

<Story name="Primary" />
