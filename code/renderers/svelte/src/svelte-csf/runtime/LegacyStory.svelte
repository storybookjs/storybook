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
  import type { Slots, StoryProps } from '../legacy-types.d.ts';

  // Props use `$props()` so this file compiles when `compilerOptions.runes` is `true`.
  // It still renders a `<slot>`, because the typing of legacy `let:args` and `let:context` comes from `$$Slots`.
  type $$Slots = Slots;

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _props: StoryProps = $props();

  let args!: $$Slots['default']['args'];
  let context!: $$Slots['default']['context'];
</script>

<slot {context} {args} />
