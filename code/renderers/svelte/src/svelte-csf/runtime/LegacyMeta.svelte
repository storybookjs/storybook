<script lang="ts">
  /**
   * This component is to support deprecated legacy component - `Meta`,
   * and this component functionality is just a "mock".
   * E.g. to allow user still have typing experience.
   * Vite pre-transform hook does codemod where this component gets transformed into `defineMeta` and inserted into
   * script module tag.
   */
  import type { Meta } from '@storybook/svelte';

  interface Props extends Meta {}

  let {}: Props = $props();
</script>
