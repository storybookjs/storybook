<script module>
  import { defineMeta } from '@storybook/svelte';
  import { Input } from './InputCollection.ts';
  const { Story } = defineMeta({ component: Input.Select });
</script>

<Story name="Primary" />
<button>Save</button>
