<script lang="ts">
  interface Props {
    /** Click callback. */
    onclick?: (event: MouseEvent) => void;
    /** Change callback. */
    onchange?: (value: string) => void;
    /** Number formatter. */
    format?: (n: number) => string;
  }

  let { onclick, onchange, format = (n) => String(n) }: Props = $props();
</script>

<button
  onclick={(event) => {
    onclick?.(event);
    onchange?.('changed');
  }}
>
  {format(2)}
</button>
