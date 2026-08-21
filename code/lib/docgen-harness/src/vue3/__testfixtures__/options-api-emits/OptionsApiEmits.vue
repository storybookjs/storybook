<script lang="ts">
// Options API on purpose: Volar reports `emits` entries only as `onX` handler props, never as
// events, so this guards the vue-docgen-api fallback restoring the events list.
import { defineComponent } from 'vue';

export default defineComponent({
  name: 'OptionsApiEmits',
  props: {
    step: { type: Number, default: 1 },
  },
  emits: ['update:by-step', 'stepped'],
  methods: {
    bump(): void {
      this.$emit('stepped');
      this.$emit('update:by-step', this.step);
    },
  },
});
</script>

<template>
  <button @click="bump">+{{ step }}</button>
</template>
