<script setup lang="ts">
interface Props {
  /** The main label text. */
  label: string;
  /** How many times the label repeats. */
  count?: number;
  /** Whether the control is enabled. */
  enabled?: boolean;
  /** Plain string tags rendered after the label. */
  tags?: string[];
  /** Arbitrary configuration object. */
  config?: { theme: string; dense: boolean };
  /** Formats the count for display. */
  formatter?: (value: number) => string;
  /** Unique token for the instance. */
  token?: symbol;
  /** Large numeric identifier. */
  big?: bigint;
}

const props = withDefaults(defineProps<Props>(), {
  count: 1,
  enabled: false,
  tags: () => [],
});
</script>

<template>
  <div :data-enabled="props.enabled">
    <span v-for="i in props.count" :key="i">{{ props.label }}</span>
    <em v-for="tag in props.tags" :key="tag">{{ tag }}</em>
  </div>
</template>
