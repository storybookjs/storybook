<script setup lang="ts">
// Records the expose section, which both engines spell differently: vue-docgen-api emits
// "expose", vue-component-meta "exposed", and extractArgTypes maps both into argTypes with
// controls disabled. One member is documented and one is not, so a baseline covers both shapes.
import { ref } from 'vue';

defineProps<{
  /** Visible label of the counter button. */
  label: string;
}>();

const count = ref(0);

function reset() {
  count.value = 0;
}

defineExpose({
  /** How many times the button has been pressed. */
  count,
  reset,
});
</script>

<template>
  <button @click="count++">{{ label }} ({{ count }})</button>
</template>
