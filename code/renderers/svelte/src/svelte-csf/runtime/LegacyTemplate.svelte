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
  import type { Slots, TemplateProps } from '../legacy-types.d';

  export let id: string = 'default';
  // silents the Svelte warning about 'id' being unused. It's only here for typing purposes.
  const silentWarningAboutId = id;

  type $$Props = TemplateProps;
  type $$Slots = Slots;

  let args: $$Slots['default']['args'];
  let context: $$Slots['default']['context'];
</script>

<slot {context} {args} />
