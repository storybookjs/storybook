<script module>
  import { defineMeta } from '@storybook/svelte';
  import { UI } from '../barrels/namespace-export.ts';
  const { Story } = defineMeta({ component: UI.Button });
</script>

<Story name="Primary" />
