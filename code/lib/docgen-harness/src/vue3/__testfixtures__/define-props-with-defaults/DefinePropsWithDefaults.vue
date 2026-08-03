<script setup lang="ts">
interface Props {
  /** Visible label. */
  label?: string;
  /** The visual size of the label. */
  size?: 'small' | 'medium' | 'large';
  /** Whether the label is disabled. */
  disabled?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  label: 'Label',
  size: 'medium',
  disabled: false,
});
</script>

<template>
  <span :class="`is-${props.size}`" :data-disabled="props.disabled">{{ props.label }}</span>
</template>
