<script setup vapor lang="ts">
import { ref } from 'vue';

defineProps<{
  /** The text shown on the button */
  label: string;
  primary?: boolean;
}>();

const emit = defineEmits<{ click: [count: number] }>();

const count = ref(0);

function onClick() {
  count.value++;
  emit('click', count.value);
}
</script>

<template>
  <button type="button" :class="{ primary }" @click="onClick">
    {{ label }} {{ count }}
    <slot />
  </button>
</template>
