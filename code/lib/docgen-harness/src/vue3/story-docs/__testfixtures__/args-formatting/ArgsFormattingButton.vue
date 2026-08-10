<script setup lang="ts">
defineProps<{
  label?: string;
  quotationLabel?: string;
  emptyLabel?: string;
  enabled?: boolean;
  disabled?: boolean;
  count?: number;
  options?: {
    tone: string;
    compact: boolean;
  };
  items?: string[];
  onSubmit?: () => void;
}>();
</script>

<template>
  <button type="button" :aria-disabled="disabled">
    {{ emptyLabel || label }} {{ enabled ? count : '' }}
  </button>
</template>
