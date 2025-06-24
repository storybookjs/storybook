<script setup lang="ts">
import { ref } from 'vue';

const label = ref('Button');
const count = ref(100);

defineExpose({
  /**
   * a label string
   */
  label,
  /**
   * a count number
   */
  count,
});
</script>

<template>
  <Pre>{{ JSON.stringify({ label, count }, null, 2) }} </Pre>
</template>
