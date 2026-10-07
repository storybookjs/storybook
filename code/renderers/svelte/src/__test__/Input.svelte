<script lang="ts">
  interface Props {
    value: string;
    oninput?: (value: string) => void;
  }
  let { value = $bindable(), oninput }: Props = $props();
</script>

<input bind:value oninput={() => oninput?.(value)} />
