<!-- <MyComponent> template -->
<script setup lang="ts">
const props = defineProps({
  label: String,
  year: Number,
});
</script>
<template>
  <div data-testid="scoped-slot">
    <slot :text="`Hello ${props.label} from the slot`" :year="props.year"></slot>
  </div>
</template>
