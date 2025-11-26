<script lang="ts">
  interface Props {
    disabled: boolean;
    label: string;
    clicked?: (e: MouseEvent) => void;
  }

  // When a Svelte 5 component only uses runes, it is typed as a function component.
  // Others are typed as class components. Hence we need to have tests for both shapes.
  let { disabled, label, clicked}: Props = $props();
</script>

<button onclick={clicked} {disabled}>
  {label}
</button>
