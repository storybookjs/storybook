<script setup lang="ts">
// Optional so the zero-arg `meta.story()` overload typechecks without meta-level args.
defineProps<{
  label?: string;
}>();
</script>

<template>
  <button type="button">{{ label }}</button>
</template>
