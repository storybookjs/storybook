<script setup lang="ts">
defineSlots<{
  /** Some description for "no-bind" slot. */
  'no-bind'(): any;
  /** Some description for "default" slot. */
  default(props: { num: number }): any;
  /** Some description for "named" slot. */
  named(props: { str: string }): any;
  /** Some description for "vbind" slot. */
  vbind(props: { num: number; str: string }): any;
}>();
</script>

<template>
  <slot name="no-bind"></slot>
  <br />
  <slot :num="123"></slot>
  <br />
  <slot name="named" str="str"></slot>
  <br />
  <slot name="vbind" v-bind="{ num: 123, str: 'str' }"></slot>
</template>
