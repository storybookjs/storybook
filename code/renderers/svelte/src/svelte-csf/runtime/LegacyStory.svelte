<!--
@component
This component is to support deprecated legacy component - `Story`,
and this component functionality is just a "mock".
E.g. to allow user still have typing experience.
Vite pre-transform hook does codemod where this component gets transformed into new `Story` component destrucutred from `defineMeta`.

@deprecated
@see {@link https://github.com/storybookjs/addon-svelte-csf/blob/main/MIGRATION.md#export-meta-removed-in-favor-of-definemeta}
-->

<script lang="ts">
  import type { Slots, StoryProps } from '../legacy-types.d';

  type $$Props = StoryProps;
  type $$Slots = Slots;

  let args: $$Slots['default']['args'];
  let context: $$Slots['default']['context'];
</script>

<slot {context} {args} />
