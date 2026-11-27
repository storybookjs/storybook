<script module lang="ts">
  import { expectTypeOf } from 'vitest';

  import type { Args } from '../../public-types.ts';
  import { defineMeta } from '../../svelte-csf/index.ts';

  import GenericExports from './generic-exports.svelte';

  // Only svelte-check runs this file: defineMeta must accept a generic component with exports
  // and still infer its props.
  const { Story } = defineMeta({ component: GenericExports<string> });
  expectTypeOf<Args<typeof Story>>().toEqualTypeOf<{ items: string[] }>();
</script>

<Story
  name="Wrong item type"
  args={{
    // @ts-expect-error items must be strings
    items: [1],
  }}
/>
