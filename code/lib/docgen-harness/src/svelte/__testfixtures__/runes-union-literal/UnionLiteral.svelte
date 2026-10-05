<script lang="ts">
  interface Props {
    /** Size variant. */
    size?: 'small' | 'medium' | 'large';
    /** Tone variant. */
    tone?: 'info' | 'warn' | null;
    /** Numeric level. */
    level: 1 | 2 | 3;
    /** Automatic mode. */
    mode?: boolean | 'auto';
  }

  let { size = 'medium', tone, level, mode }: Props = $props();
</script>

<p data-size={size} data-tone={tone} data-mode={mode}>{level}</p>
