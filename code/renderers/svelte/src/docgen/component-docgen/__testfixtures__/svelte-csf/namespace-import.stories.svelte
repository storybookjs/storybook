<script module>
  import { defineMeta } from '@storybook/svelte';
  import * as ns from './components.ts';
  const { Story } = defineMeta({ component: ns.Button });
</script>

<Story name="Primary" />
<button>Save</button>
