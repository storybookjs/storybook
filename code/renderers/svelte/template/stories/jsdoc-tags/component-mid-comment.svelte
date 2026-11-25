<!--
A comment that does not start with the marker. @component
The text after the marker.
@summary Mid comment summary
-->
<script lang="ts">
  interface Props {
    /** The text. */
    label?: string;
  }

  const { label }: Props = $props();
</script>

<span>{label}</span>
