<!--
@component
This component is to support deprecated legacy component - `Template`,
and this component functionality is just a "mock".
E.g. to allow user still have typing experience.
Vite pre-transform hook does codemod where this component gets transformed into Svelte v5 snippet block.

@deprecated
@see {@link https://github.com/storybookjs/addon-svelte-csf/blob/main/MIGRATION.md#template-component-removed}
-->
<script lang="ts">
  import type { Slots, TemplateProps } from '../../src/svelte-csf/legacy-types.d.ts';

  // Props use `$props()` so this file compiles when `compilerOptions.runes` is `true`.
  // It still renders a `<slot>`, because the typing of legacy `let:args` and `let:context` comes from `$$Slots`.
  type $$Slots = Slots;

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _props: TemplateProps = $props();

  let args!: $$Slots['default']['args'];
  let context!: $$Slots['default']['context'];
</script>

<slot {context} {args} />
