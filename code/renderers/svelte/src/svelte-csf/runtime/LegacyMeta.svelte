<!--
@component
This component is to support deprecated legacy component - `Meta`,
and this component functionality is just a "mock".
e.g. to allow user still have typing experience.
Vite pre-transform hook does codemod where this component gets transformed into `defineMeta` and inserted into script module tag.

@deprecated
@see {@link https://github.com/storybookjs/addon-svelte-csf/blob/main/MIGRATION.md#meta-component-removed-in-favor-of-definemeta}
-->
<script lang="ts">
  import type { MetaProps, Slots } from '../legacy-types.d';

  type $$Props = MetaProps;
</script>
