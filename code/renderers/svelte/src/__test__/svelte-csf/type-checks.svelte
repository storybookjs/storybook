<script module lang="ts">
  import { defineMeta } from '@storybook/svelte';

  import GenericExports from './generic-exports.svelte';

  // Only svelte-check runs this file: defineMeta must accept a generic component with exports.
  defineMeta({ component: GenericExports<string> });
</script>
