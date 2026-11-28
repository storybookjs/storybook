<!-- A plain comment before the component comment. -->
<!--
@component
The component comment comes second.
@summary Second comment summary
-->
<script lang="ts">
  interface Props {
    /** The text. */
    label?: string;
  }

  const { label }: Props = $props();
</script>

<span>{label}</span>
