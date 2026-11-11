<!-- @component JSDoc tag component. @deprecated Use another fixture. -->
<script lang="ts">
  interface Props {
    /**
     * Old label text.
     * @deprecated Use label instead.
     */
    oldLabel?: string;
    /**
     * New label text.
     * @default Current label
     */
    label?: string;
    /**
     * Example value.
     * @example "demo"
     */
    example?: string;
    /**
     * Internal value.
     * @internal
     */
    internalValue?: string;
  }

  let {
    oldLabel,
    label = 'Current label',
    example,
    internalValue,
  }: Props = $props();
</script>

<div>{label} {oldLabel} {example} {internalValue}</div>
