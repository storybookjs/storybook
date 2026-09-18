<script lang="ts" setup>
const props = defineProps<{
  foo: string;
  bar?: number;
  array: string[];
  object: Record<string, unknown>;
  modelValue?: string;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: string];
}>();

defineSlots<{
  default(): any;
  namedSlot(props: { foo: string }): any;
}>();
</script>

<template>
  <div>
    <pre>{{ props }}</pre>

    <slot></slot>
    <slot name="namedSlot" foo="Hello World"></slot>
  </div>
</template>
