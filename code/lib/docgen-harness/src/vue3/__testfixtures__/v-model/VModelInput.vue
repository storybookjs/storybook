<script setup lang="ts">
const props = defineProps<{
  /** The text value controlled via the default v-model. */
  modelValue: string;
}>();

const emit = defineEmits<{
  /** Emitted when the text value changes. */
  (e: 'update:modelValue', value: string): void;
}>();

/** Whether the box is checked, controlled via the named v-model. */
const checked = defineModel<boolean>('checked');
</script>

<template>
  <!-- Inline handler expression: a concretely-typed function reference would be checked against
       the React FormEventHandler type that hoisted @types/react leaks into the global JSX
       namespace, while inline expressions are contextually typed (same style as the renderer's
       own SFCs, e.g. renderers/vue3/src/__tests__/Button.vue). -->
  <input
    :value="props.modelValue"
    @input="emit('update:modelValue', ($event.target as HTMLInputElement).value)"
  />
  <input v-model="checked" type="checkbox" />
</template>
